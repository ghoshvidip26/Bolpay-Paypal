import "server-only";
import { createHash } from "node:crypto";
import { calculatePay } from "@/app/lib/merchant/incentives";
import { CURRENT_PERIOD, TODAY } from "@/app/lib/merchant/mock-data";
import type {
  AttendanceRecord,
  AttendanceStatus,
  IncentiveRules,
  Payout,
  Transaction,
  Worker,
} from "@/app/lib/merchant/types";
import { createPayoutBatch, getPayoutBatch, mapTransactionStatus } from "@/app/lib/paypal/payouts";
import { isLivePayPal, PayPalError } from "@/app/lib/paypal/rest";
import { getDb, saveDb } from "./db";

export class ServiceError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES: AttendanceStatus[] = ["present", "half", "absent", "leave"];
const MAX_BATCH = 100;

const str = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN);

export function getSnapshot() {
  const db = getDb();
  return { today: TODAY, period: CURRENT_PERIOD, ...db };
}
export type Snapshot = ReturnType<typeof getSnapshot>;

/* ----------------------------- workers ----------------------------- */

export function addWorker(input: Record<string, unknown>) {
  const name = str(input.name, 80);
  const role = str(input.role, 80);
  const dailyWage = num(input.dailyWage);
  const payoutEmail = str(input.payoutEmail);
  if (!name || !role) throw new ServiceError("Name and role are required");
  if (!Number.isFinite(dailyWage) || dailyWage <= 0 || dailyWage > 100_000) throw new ServiceError("Daily wage must be a positive number");
  if (payoutEmail && !EMAIL.test(payoutEmail)) throw new ServiceError("PayPal email is not valid");
  const worker: Worker = {
    id: `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    name,
    role,
    phone: str(input.phone, 40),
    payoutEmail,
    dailyWage,
    joinedOn: TODAY,
    status: "active",
  };
  getDb().workers.push(worker);
  saveDb();
}

export function updateWorker(id: string, patch: Record<string, unknown>) {
  const w = getDb().workers.find((x) => x.id === id);
  if (!w) throw new ServiceError("Worker not found", 404);
  if ("name" in patch) {
    const v = str(patch.name, 80);
    if (!v) throw new ServiceError("Name can't be empty");
    w.name = v;
  }
  if ("role" in patch) {
    const v = str(patch.role, 80);
    if (!v) throw new ServiceError("Role can't be empty");
    w.role = v;
  }
  if ("phone" in patch) w.phone = str(patch.phone, 40);
  if ("payoutEmail" in patch) {
    const v = str(patch.payoutEmail);
    if (v && !EMAIL.test(v)) throw new ServiceError("PayPal email is not valid");
    w.payoutEmail = v;
  }
  if ("dailyWage" in patch) {
    const v = num(patch.dailyWage);
    if (!Number.isFinite(v) || v <= 0 || v > 100_000) throw new ServiceError("Daily wage must be a positive number");
    w.dailyWage = v;
  }
  if ("status" in patch) {
    if (patch.status !== "active" && patch.status !== "inactive") throw new ServiceError("Invalid status");
    w.status = patch.status;
  }
  saveDb();
}

/* ---------------------------- attendance ---------------------------- */

export function setAttendance(workerId: string, date: string, patch: Record<string, unknown>) {
  const db = getDb();
  if (!db.workers.some((w) => w.id === workerId)) throw new ServiceError("Worker not found", 404);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < CURRENT_PERIOD.start || date > TODAY) {
    throw new ServiceError("Date must be inside the current pay period and not in the future");
  }
  let rec = db.attendance.find((r) => r.workerId === workerId && r.date === date);
  if (!rec) {
    rec = { workerId, date, status: "present", overtimeHours: 0, units: 0 } satisfies AttendanceRecord;
    db.attendance.push(rec);
  }
  if ("status" in patch) {
    if (!STATUSES.includes(patch.status as AttendanceStatus)) throw new ServiceError("Invalid attendance status");
    rec.status = patch.status as AttendanceStatus;
  }
  if ("overtimeHours" in patch) {
    const v = num(patch.overtimeHours);
    if (!Number.isFinite(v) || v < 0 || v > 24) throw new ServiceError("Overtime must be between 0 and 24 hours");
    rec.overtimeHours = v;
  }
  if ("units" in patch) {
    const v = num(patch.units);
    if (!Number.isFinite(v) || v < 0 || v > 100_000) throw new ServiceError("Units must be zero or more");
    rec.units = Math.round(v);
  }
  if (rec.status === "absent" || rec.status === "leave") {
    rec.overtimeHours = 0;
    rec.units = 0;
  }
  saveDb();
}

/* ------------------------------ rules ------------------------------ */

export function setRules(input: Record<string, unknown>) {
  const keys: (keyof IncentiveRules)[] = [
    "workingHoursPerDay", "overtimeMultiplier", "dailyUnitTarget", "ratePerExtraUnit", "attendanceThreshold", "attendanceBonus",
  ];
  const next = {} as IncentiveRules;
  for (const k of keys) {
    const v = num(input[k]);
    if (!Number.isFinite(v) || v < 0) throw new ServiceError(`Rule "${k}" must be zero or more`);
    next[k] = v;
  }
  if (next.workingHoursPerDay <= 0) throw new ServiceError("Working hours per day must be above zero");
  if (next.attendanceThreshold > 1) throw new ServiceError("Attendance threshold must be between 0 and 1");
  getDb().rules = next;
  saveDb();
}

/* ------------------------------ payouts ------------------------------ */

/** Computes the current period for each active worker and queues payouts for approval. */
export function submitPeriod(): number {
  const db = getDb();
  const done = new Set(db.payouts.filter((p) => p.periodId === CURRENT_PERIOD.id).map((p) => p.workerId));
  const records = db.attendance.filter((r) => r.date >= CURRENT_PERIOD.start && r.date <= CURRENT_PERIOD.end);
  const now = new Date().toISOString();
  const created: Payout[] = [];
  for (const w of db.workers) {
    if (w.status !== "active" || done.has(w.id)) continue;
    const breakdown = calculatePay(w, records, db.rules);
    if (breakdown.total <= 0) continue;
    created.push({
      id: `po-${CURRENT_PERIOD.id}-${w.id}`,
      workerId: w.id,
      periodId: CURRENT_PERIOD.id,
      periodLabel: CURRENT_PERIOD.label,
      breakdown,
      amount: breakdown.total,
      status: "pending",
      submittedAt: now,
    });
  }
  db.payouts.push(...created);
  saveDb();
  return created.length;
}

/** Approve or reject pending payouts. Approving starts the PayPal transfers. */
export async function decidePayouts(ids: string[], decision: "approved" | "rejected") {
  const db = getDb();
  const now = new Date().toISOString();
  const pending = db.payouts.filter((p) => ids.includes(p.id) && p.status === "pending");
  if (pending.length === 0) throw new ServiceError("No pending payouts to act on", 409);

  // Mark and create transactions synchronously (before any await) so a concurrent
  // second request for the same payouts finds them already decided.
  const txs: Transaction[] = [];
  for (const p of pending) {
    p.status = decision;
    p.decidedAt = now;
    if (decision === "approved") {
      txs.push({
        id: `tx-${p.id}`,
        payoutId: p.id,
        workerId: p.workerId,
        periodLabel: p.periodLabel,
        amount: p.amount,
        status: "processing",
        createdAt: now,
        reference: "Submitting…",
        attempt: 1,
      });
    }
  }
  db.transactions.push(...txs);
  saveDb();
  if (txs.length) await submitToPayPal(txs.map((t) => t.id));
}

export async function retryTransaction(id: string) {
  const db = getDb();
  const tx = db.transactions.find((t) => t.id === id);
  if (!tx) throw new ServiceError("Transaction not found", 404);
  if (tx.status !== "failed") throw new ServiceError("Only failed transactions can be retried", 409);
  tx.status = "processing";
  tx.failureReason = undefined;
  tx.reference = "Submitting…";
  tx.batchId = undefined;
  tx.attempt = (tx.attempt ?? 1) + 1;
  saveDb();
  await submitToPayPal([tx.id]);
}

function fail(tx: Transaction, reason: string) {
  tx.status = "failed";
  tx.failureReason = reason;
}

/** Sends the given transactions to PayPal using only amounts and emails stored on the server. */
async function submitToPayPal(txIds: string[]) {
  const db = getDb();
  const currency = process.env.PAYOUT_CURRENCY || "USD";
  const txs = db.transactions.filter((t) => txIds.includes(t.id));

  if (isLivePayPal && process.env.ALLOW_LIVE_PAYOUTS !== "true") {
    txs.forEach((t) => fail(t, "Live payouts are disabled (set ALLOW_LIVE_PAYOUTS=true)"));
    saveDb();
    return;
  }

  const sendable: { tx: Transaction; email: string }[] = [];
  for (const tx of txs) {
    const email = db.workers.find((w) => w.id === tx.workerId)?.payoutEmail ?? "";
    if (!EMAIL.test(email)) fail(tx, "Worker has no valid PayPal account on file");
    else if (!(tx.amount > 0)) fail(tx, "Invalid payout amount");
    else sendable.push({ tx, email });
  }

  for (let i = 0; i < sendable.length; i += MAX_BATCH) {
    const chunk = sendable.slice(i, i + MAX_BATCH);
    const attempt = Math.max(...chunk.map((c) => c.tx.attempt ?? 1));
    // Same payouts + same attempt = same id, so PayPal dedupes a repeated submission.
    const digest = createHash("sha256").update(chunk.map((c) => c.tx.payoutId).sort().join("|")).digest("hex").slice(0, 32);
    const senderBatchId = `paycrew-${digest}-${attempt}`;
    try {
      const { batchId } = await createPayoutBatch({
        senderBatchId,
        currency,
        items: chunk.map((c) => ({ payoutId: c.tx.payoutId, email: c.email, amount: c.tx.amount })),
      });
      chunk.forEach((c) => (c.tx.batchId = batchId));
    } catch (err) {
      console.error("PayPal payout submission failed", err);
      const detail = err instanceof PayPalError ? err.message : "Unexpected error";
      chunk.forEach((c) => fail(c.tx, `PayPal rejected the batch: ${detail}`));
    }
  }
  saveDb();
}

/** Pulls live item statuses from PayPal for every batch that still has processing items. */
export async function syncTransactions() {
  const db = getDb();
  const batchIds = [...new Set(db.transactions.filter((t) => t.status === "processing" && t.batchId).map((t) => t.batchId!))];
  for (const batchId of batchIds) {
    try {
      const batch = await getPayoutBatch(batchId);
      for (const item of batch.items) {
        const tx = db.transactions.find((t) => t.payoutId === item.payoutId && t.batchId === batchId);
        if (tx) applyItemStatus(tx, item.status, item.paypalItemId, item.error);
      }
    } catch (err) {
      console.error(`Could not sync PayPal batch ${batchId}`, err);
    }
  }
  saveDb();
}

function applyItemStatus(tx: Transaction, status: Transaction["status"], paypalItemId?: string, error?: string) {
  if (paypalItemId) tx.reference = paypalItemId;
  tx.status = status;
  tx.failureReason = status === "failed" ? (error ?? "Payment failed") : undefined;
}

/** Applies a verified PAYMENT.PAYOUTS-ITEM.* webhook event. */
export function applyWebhookItem(item: { payoutId: string; transactionStatus?: string; paypalItemId?: string; error?: string }) {
  const tx = getDb().transactions.find((t) => t.payoutId === item.payoutId);
  if (!tx) return false;
  applyItemStatus(tx, mapTransactionStatus(item.transactionStatus), item.paypalItemId, item.error);
  saveDb();
  return true;
}
