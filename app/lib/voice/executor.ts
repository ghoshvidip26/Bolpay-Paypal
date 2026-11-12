import "server-only";
import { formatMoney, formatUsd } from "@/app/lib/merchant/format";
import { getPeriod, getToday } from "@/app/lib/server/context";
import { getDb, logAudit } from "@/app/lib/server/db";
import {
  addWorker,
  decidePayouts,
  retryTransaction,
  ServiceError,
  setAttendance,
  setRules,
  settlement,
  submitPeriod,
  syncTransactions,
  updateWorker,
} from "@/app/lib/server/service";
import { answerQuery } from "./queries";
import { resolveSelector } from "./selectors";
import type { MoneyPreview, ResolvedStep, Selector } from "./types";

export interface StepOutcome {
  ok: boolean;
  skipped?: boolean;
  message: string;
}

export interface RunResult {
  /** One entry per step that was attempted; steps after a failure have no entry. */
  outcomes: Record<number, StepOutcome>;
  /** Index of the first step that did not run. */
  cursor: number;
  /** Set when a money step needs the manager to confirm exact figures first. */
  checkpoint?: { stepIndex: number; preview: MoneyPreview };
  navigate?: string;
}

const PAGE_PATH: Record<string, string> = {
  dashboard: "/dashboard",
  workers: "/workers",
  attendance: "/attendance",
  incentives: "/incentives",
  payouts: "/payouts",
  transactions: "/transactions",
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const count = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/** Workers a step applies to, resolved against the data as it is right now. */
function targets(step: ResolvedStep): string[] | null {
  const r = resolveSelector((step.args.workers as Selector | null) ?? null, { date: (step.args.date as string) ?? getToday(), defaultAll: true, includeInactive: step.action === "update_worker" });
  return "workers" in r ? r.workers.map((w) => w.id) : null;
}

/** Exactly what a money step would move right now. Null for steps that don't move money. */
export function previewMoney(step: ResolvedStep): MoneyPreview | null {
  if (step.risk !== "money") return null;
  const db = getDb();
  const ids = targets(step);
  if (!ids) return { count: 0, totalInr: 0, totalUsd: 0, names: [], skipped: [] };
  const { rate } = settlement();
  const nameOf = (id: string) => db.workers.find((w) => w.id === id)?.name ?? "Unknown";
  const items =
    step.action === "approve_payouts"
      ? db.payouts.filter((p) => p.status === "pending" && ids.includes(p.workerId)).map((p) => ({ workerId: p.workerId, amount: p.amount }))
      : db.transactions.filter((t) => t.status === "failed" && t.periodLabel === getPeriod().label && ids.includes(t.workerId)).map((t) => ({ workerId: t.workerId, amount: t.amount }));
  const skipped = [...new Set(items.filter((i) => !db.workers.find((w) => w.id === i.workerId)?.payoutEmail).map((i) => nameOf(i.workerId)))];
  return {
    count: items.length,
    totalInr: round2(items.reduce((s, i) => s + i.amount, 0)),
    totalUsd: round2(items.reduce((s, i) => s + Math.round((i.amount / rate) * 100) / 100, 0)),
    names: items.map((i) => nameOf(i.workerId)),
    skipped,
  };
}

export const samePreview = (a: MoneyPreview, b: MoneyPreview) => a.count === b.count && a.totalInr === b.totalInr && a.names.join("|") === b.names.join("|");

export function describePreview(p: MoneyPreview): string {
  const who = p.names.length <= 5 ? p.names.join(", ") : `${p.names.slice(0, 5).join(", ")} and ${p.names.length - 5} more`;
  const warn = p.skipped.length ? ` ${p.skipped.join(", ")} ${p.skipped.length === 1 ? "has" : "have"} no PayPal email, so that payment will fail.` : "";
  return `${count(p.count, "payment")} totalling ${formatMoney(p.totalInr)} (${formatUsd(p.totalUsd)} sent to PayPal): ${who}.${warn}`;
}

const failMessage = (e: unknown) => (e instanceof ServiceError ? e.message : "Something went wrong");

async function runStep(step: ResolvedStep, dryRun: boolean): Promise<StepOutcome & { navigate?: string }> {
  const db = getDb();
  const a = step.args;
  const date = (a.date as string | null) ?? getToday();
  const ids = step.action === "add_worker" || step.action === "set_rule" || step.action === "set_tier" || step.action === "remove_tier" || step.action === "navigate" || step.action === "sync_status" ? [] : targets(step);
  if (ids === null) return { ok: false, message: "I couldn't work out which workers you meant." };
  const nameOf = (id: string) => db.workers.find((w) => w.id === id)?.name ?? "Unknown";
  const dateWord = date === getToday() ? "today" : date;

  switch (step.action) {
    case "mark_attendance":
    case "record_overtime":
    case "record_units": {
      const patch = step.action === "mark_attendance" ? { status: a.status } : step.action === "record_overtime" ? { overtimeHours: a.hours } : { units: a.units };
      const what = step.action === "mark_attendance" ? `marked ${a.status}` : step.action === "record_overtime" ? `${a.hours} overtime hours recorded` : `${a.units} deliveries recorded`;
      if (dryRun) return { ok: true, message: `Would have ${what} for ${count(ids.length, "worker")} (${dateWord}).` };
      const failed: string[] = [];
      for (const id of ids) {
        try {
          setAttendance(id, date, patch);
        } catch (e) {
          failed.push(`${nameOf(id)}: ${failMessage(e)}`);
        }
      }
      logAudit("voice." + step.action, `${ids.length - failed.length} workers, ${what}, ${date}`);
      if (failed.length === ids.length) return { ok: false, message: failed[0] };
      return { ok: true, message: `${what[0].toUpperCase()}${what.slice(1)} for ${count(ids.length - failed.length, "worker")} (${dateWord}).${failed.length ? ` Failed for ${failed.length}.` : ""}` };
    }

    case "prepare_payouts": {
      if (dryRun) return { ok: true, message: `Would prepare payouts for up to ${count(ids.length, "worker")}.` };
      const r = submitPeriod({ workerIds: ids });
      const parts = [];
      if (r.created) parts.push(`${count(r.created, "payout")} ready for approval`);
      if (r.needsReview) parts.push(`${r.needsReview} flagged Needs Review (missing or conflicting records)`);
      if (!parts.length) return { ok: true, skipped: true, message: "Nothing new to prepare for that selection." };
      return { ok: true, message: `Prepared payouts: ${parts.join(", ")}.` };
    }

    case "approve_payouts":
    case "reject_payouts": {
      const decision = step.action === "approve_payouts" ? "approved" : "rejected";
      const pending = db.payouts.filter((p) => p.status === "pending" && ids.includes(p.workerId));
      if (!pending.length) return { ok: true, skipped: true, message: "No pending payouts matched, so nothing was " + decision + "." };
      if (dryRun) return { ok: true, message: `Would have ${decision} ${count(pending.length, "payout")} (${formatMoney(pending.reduce((s, p) => s + p.amount, 0))}).` };
      try {
        await decidePayouts(pending.map((p) => p.id), decision);
      } catch (e) {
        return { ok: false, message: failMessage(e) };
      }
      const txs = db.transactions.filter((t) => pending.some((p) => p.id === t.payoutId));
      const failedNow = txs.filter((t) => t.status === "failed");
      if (decision === "rejected") return { ok: true, message: `Rejected ${count(pending.length, "payout")}.` };
      return {
        ok: true,
        message: `Approved ${count(pending.length, "payout")} (${formatMoney(pending.reduce((s, p) => s + p.amount, 0))}) and sent them to PayPal.${failedNow.length ? ` ${count(failedNow.length, "payment")} failed straight away: ${failedNow.map((t) => nameOf(t.workerId)).join(", ")}.` : ""}`,
      };
    }

    case "retry_failed": {
      const failed = db.transactions.filter((t) => t.status === "failed" && t.periodLabel === getPeriod().label && ids.includes(t.workerId));
      if (!failed.length) return { ok: true, skipped: true, message: "No failed payments matched." };
      if (dryRun) return { ok: true, message: `Would have retried ${count(failed.length, "failed payment")}.` };
      let retried = 0;
      for (const t of failed) {
        try {
          await retryTransaction(t.id);
          retried++;
        } catch {
          /* counted below */
        }
      }
      return { ok: retried > 0, message: `Retried ${count(retried, "failed payment")}.` };
    }

    case "sync_status": {
      if (dryRun) return { ok: true, message: "Would refresh payment statuses from PayPal." };
      await syncTransactions();
      return { ok: true, message: "Payment statuses refreshed from PayPal." };
    }

    case "update_worker": {
      const id = ids[0];
      const field = a.field as string;
      const value = field === "dailyWage" ? Number(a.value) : String(a.value);
      const patch = field === "status" ? { status: value } : { [field]: value };
      if (dryRun) return { ok: true, message: `Would set ${field} for ${nameOf(id)}.` };
      try {
        updateWorker(id, patch);
      } catch (e) {
        return { ok: false, message: failMessage(e) };
      }
      logAudit("voice.update_worker", `${nameOf(id)}: ${field}`);
      return { ok: true, message: `Updated ${field === "payoutEmail" ? "the PayPal email" : field} for ${nameOf(id)}.` };
    }

    case "add_worker": {
      if (dryRun) return { ok: true, message: `Would add ${a.name}.` };
      try {
        addWorker({ name: a.name, role: a.role ?? "Delivery Rider", city: a.city ?? "Bengaluru", dailyWage: a.dailyWage, payoutEmail: a.payoutEmail ?? "" });
      } catch (e) {
        return { ok: false, message: failMessage(e) };
      }
      return { ok: true, message: `Added ${a.name}${a.payoutEmail ? "" : " (no PayPal email yet, so payouts will fail until you add one)"}.` };
    }

    case "set_rule":
    case "set_tier":
    case "remove_tier": {
      const rules = db.rules;
      const next: Record<string, unknown> = { ...rules, deliveryTiers: rules.deliveryTiers.map((t) => ({ ...t })) };
      let message: string;
      if (step.action === "set_rule") {
        next[a.ruleKey as string] = a.amount;
        message = `Set ${a.ruleKey} to ${a.amount}.`;
      } else if (step.action === "set_tier") {
        const tiers = next.deliveryTiers as { minUnits: number; bonus: number }[];
        const hit = tiers.find((t) => t.minUnits === a.minUnits);
        if (hit) hit.bonus = a.amount as number;
        else tiers.push({ minUnits: a.minUnits as number, bonus: a.amount as number });
        message = `The ${a.minUnits}-delivery tier now pays ₹${a.amount}.`;
      } else {
        const tiers = next.deliveryTiers as { minUnits: number }[];
        if (!tiers.some((t) => t.minUnits === a.minUnits)) return { ok: true, skipped: true, message: `There is no ${a.minUnits}-delivery tier.` };
        next.deliveryTiers = tiers.filter((t) => t.minUnits !== a.minUnits);
        message = `Removed the ${a.minUnits}-delivery tier.`;
      }
      if (dryRun) return { ok: true, message: `Would update rules: ${message}` };
      try {
        setRules(next);
      } catch (e) {
        return { ok: false, message: failMessage(e) };
      }
      return { ok: true, message: `${message} Rules are now version ${getDb().rules.version}.` };
    }

    case "query":
      return { ok: true, message: answerQuery(a.query as string, { workerIds: a.workers ? ids : null, date, n: (a.n as number | null) ?? null }) };

    case "navigate": {
      const path = PAGE_PATH[a.page as string];
      return path ? { ok: true, message: `Opening ${a.page}.`, navigate: path } : { ok: false, message: "I don't know that screen." };
    }
  }
  return { ok: false, message: "That action isn't supported." };
}

export type VoiceRole = "owner" | "supervisor";

/** Supervisors record the day's work and prepare payouts; everything else is owner-only. */
const SUPERVISOR_ACTIONS = new Set(["mark_attendance", "record_overtime", "record_units", "prepare_payouts", "query", "navigate"]);

export function allowedFor(role: VoiceRole, step: ResolvedStep) {
  return role === "owner" || SUPERVISOR_ACTIONS.has(step.action);
}

/**
 * Runs steps top to bottom starting at `cursor`. Stops at the first failure, and pauses before any
 * money step whose exact figures the manager hasn't confirmed (or whose figures changed since).
 * With dryRun nothing is written and PayPal is never called.
 */
export async function runPlan(steps: ResolvedStep[], cursor: number, dryRun: boolean, role: VoiceRole = "supervisor"): Promise<RunResult> {
  const outcomes: Record<number, StepOutcome> = {};
  let navigate: string | undefined;
  for (let i = cursor; i < steps.length; i++) {
    const step = steps[i];
    if (!allowedFor(role, step)) {
      outcomes[i] = { ok: false, message: "Only the owner can do that. Ask the owner to approve it." };
      return { outcomes, cursor: i + 1, navigate };
    }
    if (step.risk === "money" && dryRun && steps.slice(0, i).some((x) => x.risk !== "read")) {
      // A dry run can't create the payouts an earlier step would, so say what a real run would do.
      outcomes[i] = { ok: true, message: "A real run would pause here and show the exact amount before sending any money." };
      continue;
    }
    if (step.risk === "money") {
      const live = previewMoney(step);
      if (live && live.count === 0) {
        outcomes[i] = { ok: true, skipped: true, message: "Nothing matched, so no money moves for this step." };
        continue;
      }
      if (live && (!step.expect || !samePreview(step.expect, live))) return { outcomes, cursor: i, checkpoint: { stepIndex: i, preview: live }, navigate };
    }
    const out = await runStep(step, dryRun);
    outcomes[i] = { ok: out.ok, skipped: out.skipped, message: out.message };
    if (out.navigate) navigate = out.navigate;
    if (!out.ok) return { outcomes, cursor: i + 1, navigate };
  }
  return { outcomes, cursor: steps.length, navigate };
}
