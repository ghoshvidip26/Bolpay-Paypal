import "server-only";
import { createHash } from "node:crypto";
import { calculatePay } from "@/app/lib/merchant/incentives";
import { dateRange, formatDate } from "@/app/lib/merchant/format";
import { CURRENT_PERIOD, DEFAULT_INR_PER_USD, TODAY } from "@/app/lib/merchant/mock-data";
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
import { parseCsv } from "./csv";
import { getDb, logAudit, saveDb } from "./db";

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
  const { workers, attendance, rules, payouts, transactions } = getDb();
  return { today: TODAY, period: CURRENT_PERIOD, workers, attendance, rules, payouts, transactions };
}
export type Snapshot = ReturnType<typeof getSnapshot>;

/* ----------------------------- workers ----------------------------- */

function buildWorker(input: Record<string, unknown>): Worker {
  const name = str(input.name, 80);
  const role = str(input.role, 80);
  const dailyWage = num(input.dailyWage);
  const payoutEmail = str(input.payoutEmail);
  if (!name || !role) throw new ServiceError("Name and role are required");
  if (!Number.isFinite(dailyWage) || dailyWage <= 0 || dailyWage > 100_000) throw new ServiceError("Daily wage must be a positive number");
  if (payoutEmail && !EMAIL.test(payoutEmail)) throw new ServiceError("PayPal email is not valid");
  return {
    id: `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    name,
    role,
    city: str(input.city, 60) || "Bengaluru",
    phone: str(input.phone, 40),
    payoutEmail,
    dailyWage,
    joinedOn: TODAY,
    status: "active",
  };
}

export function addWorker(input: Record<string, unknown>) {
  const worker = buildWorker(input);
  getDb().workers.push(worker);
  logAudit("worker.add", `${worker.name} (${worker.city})`);
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
  if ("city" in patch) {
    const v = str(patch.city, 60);
    if (!v) throw new ServiceError("City can't be empty");
    w.city = v;
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

function applyAttendance(workerId: string, date: string, patch: Record<string, unknown>) {
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
}

export function setAttendance(workerId: string, date: string, patch: Record<string, unknown>) {
  applyAttendance(workerId, date, patch);
  saveDb();
}

/* ------------------------------ rules ------------------------------ */

export function setRules(input: Record<string, unknown>) {
  const keys = ["workingHoursPerDay", "overtimeMultiplier", "dailyUnitTarget", "ratePerExtraUnit", "attendanceThreshold", "attendanceBonus"] as const;
  const prev = getDb().rules;
  const next = { ...prev } as IncentiveRules;
  for (const k of keys) {
    const v = num(input[k]);
    if (!Number.isFinite(v) || v < 0) throw new ServiceError(`Rule "${k}" must be zero or more`);
    next[k] = v;
  }
  if (next.workingHoursPerDay <= 0) throw new ServiceError("Working hours per day must be above zero");
  if (next.attendanceThreshold > 1) throw new ServiceError("Attendance threshold must be between 0 and 1");
  if ("deliveryTiers" in input) {
    if (!Array.isArray(input.deliveryTiers) || input.deliveryTiers.length > 10) throw new ServiceError("Provide up to 10 delivery tiers");
    next.deliveryTiers = input.deliveryTiers
      .map((t) => {
        const o = (t ?? {}) as Record<string, unknown>;
        const minUnits = num(o.minUnits);
        const bonus = num(o.bonus);
        if (!Number.isFinite(minUnits) || minUnits < 1 || !Number.isFinite(bonus) || bonus < 0) throw new ServiceError("Each tier needs deliveries of at least 1 and a bonus of zero or more");
        return { minUnits: Math.round(minUnits), bonus };
      })
      .sort((x, y) => x.minUnits - y.minUnits);
  }
  next.version = (prev.version ?? 1) + 1;
  getDb().rules = next;
  logAudit("rules.update", `version ${next.version}`);
  saveDb();
}

/* ------------------------------ payouts ------------------------------ */

/** How many payouts (any status) this worker already has in the current period; keeps ids unique after a rejection. */
function previousAttempts(payouts: Payout[], workerId: string) {
  return payouts.filter((p) => p.periodId === CURRENT_PERIOD.id && p.workerId === workerId).length;
}

export interface PrepareFilter {
  city?: string | null;
  /** Only workers with at least this many deliveries on `date` are included. */
  minUnits?: number | null;
  /** Defaults to today. */
  date?: string | null;
}

const normCity = (c: string) => c.normalize("NFKC").toLowerCase().trim();

/** Missing or conflicting records for a worker in the current period (days before today). */
function reviewReasons(w: Worker, records: AttendanceRecord[]): string[] {
  const reasons: string[] = [];
  const mine = records.filter((r) => r.workerId === w.id);
  const days = dateRange(CURRENT_PERIOD.start, CURRENT_PERIOD.end).filter((d) => d < TODAY && d >= w.joinedOn);
  const have = new Set(mine.map((r) => r.date));
  const missing = days.filter((d) => !have.has(d));
  if (missing.length) {
    const list = missing.slice(0, 3).map(formatDate).join(", ");
    reasons.push(`Missing attendance on ${list}${missing.length > 3 ? ` and ${missing.length - 3} more` : ""}`);
  }
  for (const r of mine) {
    if ((r.status === "absent" || r.status === "leave") && (r.units > 0 || r.overtimeHours > 0)) {
      reasons.push(`Conflicting record on ${formatDate(r.date)}: marked ${r.status} but ${r.units} deliveries logged`);
    }
  }
  return reasons;
}

/**
 * Computes the current period and queues payouts for approval. Workers with missing or
 * conflicting records become "needs_review" and can't be approved until the data is fixed
 * (then submit again: stale needs_review payouts are recomputed).
 */
export function submitPeriod(filter: PrepareFilter = {}): { created: number; needsReview: number; skipped: number } {
  const db = getDb();
  db.payouts = db.payouts.filter((p) => !(p.periodId === CURRENT_PERIOD.id && p.status === "needs_review"));
  // Rejected payouts don't block a new submission; pending and approved ones do.
  const done = new Set(db.payouts.filter((p) => p.periodId === CURRENT_PERIOD.id && p.status !== "rejected").map((p) => p.workerId));
  const records = db.attendance.filter((r) => r.date >= CURRENT_PERIOD.start && r.date <= CURRENT_PERIOD.end);
  const filterDate = filter.date ?? TODAY;
  const now = new Date().toISOString();
  const created: Payout[] = [];
  let skipped = 0;
  for (const w of db.workers) {
    if (w.status !== "active" || done.has(w.id)) continue;
    if (filter.city && normCity(w.city) !== normCity(filter.city)) {
      skipped++;
      continue;
    }
    if (filter.minUnits != null) {
      const day = records.find((r) => r.workerId === w.id && r.date === filterDate);
      const qualifies = day && (day.status === "present" || day.status === "half") && day.units >= filter.minUnits;
      if (!qualifies) {
        skipped++;
        continue;
      }
    }
    const reasons = reviewReasons(w, records);
    const breakdown = calculatePay(w, records, db.rules);
    if (breakdown.total <= 0 && reasons.length === 0) continue;
    created.push({
      id: previousAttempts(db.payouts, w.id) === 0 ? `po-${CURRENT_PERIOD.id}-${w.id}` : `po-${CURRENT_PERIOD.id}-${w.id}-r${previousAttempts(db.payouts, w.id) + 1}`,
      workerId: w.id,
      periodId: CURRENT_PERIOD.id,
      periodLabel: CURRENT_PERIOD.label,
      breakdown,
      amount: breakdown.total,
      status: reasons.length ? "needs_review" : "pending",
      reviewReasons: reasons.length ? reasons : undefined,
      ruleVersion: db.rules.version,
      rulesSnapshot: structuredClone(db.rules),
      submittedAt: now,
    });
  }
  db.payouts.push(...created);
  const needsReview = created.filter((p) => p.status === "needs_review").length;
  logAudit("period.submit", `${created.length} payouts (${needsReview} need review), rules v${db.rules.version}, filter ${JSON.stringify(filter)}`);
  saveDb();
  return { created: created.length - needsReview, needsReview, skipped };
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
  logAudit(`payout.${decision}`, `${pending.length} payout(s): ${pending.map((p) => p.id).join(', ')}`);
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
  if (tx.reference === "Submitting…") tx.reference = "—";
}

/** Sends the given transactions to PayPal using only amounts and emails stored on the server. */
async function submitToPayPal(txIds: string[]) {
  const db = getDb();
  const currency = process.env.PAYOUT_CURRENCY || "USD";
  // Amounts are stored in INR; PayPal settles in `currency` at this rate (1 when paying in INR).
  const rate = currency === "INR" ? 1 : Number(process.env.INR_PER_USD) || DEFAULT_INR_PER_USD;
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
    else if (!(tx.amount > 0) || !(Math.round((tx.amount / rate) * 100) > 0)) fail(tx, "Invalid payout amount");
    else {
      tx.fxRate = rate;
      tx.usdAmount = Math.round((tx.amount / rate) * 100) / 100;
      sendable.push({ tx, email });
    }
  }

  for (let i = 0; i < sendable.length; i += MAX_BATCH) {
    const chunk = sendable.slice(i, i + MAX_BATCH);
    const attempt = Math.max(...chunk.map((c) => c.tx.attempt ?? 1));
    // Same payouts + same attempt = same id, so PayPal dedupes a repeated submission.
    const digest = createHash("sha256").update((db.batchSalt ?? "") + chunk.map((c) => c.tx.payoutId).sort().join("|")).digest("hex").slice(0, 32);
    const senderBatchId = `paycrew-${digest}-${attempt}`;
    try {
      const { batchId } = await createPayoutBatch({
        senderBatchId,
        currency,
        items: chunk.map((c) => ({ payoutId: c.tx.payoutId, email: c.email, amount: c.tx.usdAmount ?? c.tx.amount })),
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

/* ------------------------------ CSV import ------------------------------ */

const MAX_IMPORT_ROWS = 500;
export interface ImportResult {
  imported: number;
  errors: string[];
}

function rowsOf(csv: string) {
  const rows = parseCsv(csv);
  if (rows.length === 0) throw new ServiceError("The CSV is empty or has no data rows");
  if (rows.length > MAX_IMPORT_ROWS) throw new ServiceError(`Import at most ${MAX_IMPORT_ROWS} rows at a time`);
  return rows;
}

const normName = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

/** Columns: name, role, city, phone, payoutEmail (or email), dailyWage (or wage). Duplicates (same name + city) are skipped. */
export function importWorkers(csv: string): ImportResult {
  const db = getDb();
  const errors: string[] = [];
  let imported = 0;
  rowsOf(csv).forEach((r, i) => {
    const line = i + 2;
    try {
      const w = buildWorker({
        name: r.name,
        role: r.role || "Delivery Rider",
        city: r.city,
        phone: r.phone,
        payoutEmail: r.payoutemail ?? r.email,
        dailyWage: r.dailywage ?? r.wage,
      });
      if (db.workers.some((x) => normName(x.name) === normName(w.name) && normCity(x.city) === normCity(w.city))) {
        errors.push(`Row ${line}: ${w.name} already exists in ${w.city}, skipped`);
        return;
      }
      w.id = `w${Date.now().toString(36)}${i.toString(36)}${Math.random().toString(36).slice(2, 4)}`;
      db.workers.push(w);
      imported++;
    } catch (e) {
      errors.push(`Row ${line}: ${e instanceof ServiceError ? e.message : "invalid row"}`);
    }
  });
  logAudit("import.workers", `${imported} imported, ${errors.length} problems`);
  saveDb();
  return { imported, errors: errors.slice(0, 20) };
}

/** Columns: worker (name or id), date (YYYY-MM-DD), deliveries (or units), status (default present), overtime (optional). */
export function importDeliveries(csv: string): ImportResult {
  const db = getDb();
  const errors: string[] = [];
  let imported = 0;
  rowsOf(csv).forEach((r, i) => {
    const line = i + 2;
    try {
      const key = r.worker ?? r.workerid ?? r.name ?? "";
      const w = db.workers.find((x) => x.id === key) ?? db.workers.find((x) => normName(x.name) === normName(key));
      if (!w) throw new ServiceError(`worker "${key}" not found`);
      const patch: Record<string, unknown> = {};
      const units = r.deliveries ?? r.units;
      if (units) patch.units = units;
      const ot = r.overtime ?? r.overtimehours;
      if (ot) patch.overtimeHours = ot;
      patch.status = r.status || "present";
      applyAttendance(w.id, r.date, patch);
      imported++;
    } catch (e) {
      errors.push(`Row ${line}: ${e instanceof ServiceError ? e.message : "invalid row"}`);
    }
  });
  logAudit("import.deliveries", `${imported} imported, ${errors.length} problems`);
  saveDb();
  return { imported, errors: errors.slice(0, 20) };
}
