import "server-only";
import { extractIntent, type RawIntent } from "@/app/lib/ai/intent";
import { translateReply } from "@/app/lib/ai/translate";
import { PAGES, type IntentContext, type IntentPlan } from "@/app/lib/merchant/intent-types";
import { CURRENT_PERIOD, TODAY } from "@/app/lib/merchant/mock-data";
import type { Worker } from "@/app/lib/merchant/types";
import { getDb } from "./db";

const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

type Match = { worker: Worker } | { question: string };

/** Deterministic worker lookup. The model suggests a name; we decide which record it is. */
export function findWorker(name: string | null, workers: Worker[]): Match {
  if (!name) return { question: "Which worker do you mean?" };
  const active = workers.filter((w) => w.status === "active");
  const q = norm(name);
  const exact = active.filter((w) => norm(w.name) === q);
  if (exact.length === 1) return { worker: exact[0] };
  const partial = active.filter((w) => {
    const full = norm(w.name);
    return full.includes(q) || q.includes(full) || full.split(" ").some((p) => p.length > 2 && q.split(" ").includes(p));
  });
  if (partial.length === 1) return { worker: partial[0] };
  if (partial.length > 1) return { question: `Which one: ${partial.map((w) => w.name).join(" or ")}?` };
  return { question: `I couldn't find a worker called "${name}". Who did you mean?` };
}

function resolveDate(date: string | null): { date: string } | { reason: string } {
  const d = date ?? TODAY;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) return { reason: "I couldn't understand that date." };
  if (d > TODAY) return { reason: "That date is in the future." };
  if (d < CURRENT_PERIOD.start) return { reason: `That date is before the current pay period (${CURRENT_PERIOD.label}).` };
  return { date: d };
}

function statusAnswer(query: RawIntent["statusQuery"]): string {
  const db = getDb();
  const name = (id: string) => db.workers.find((w) => w.id === id)?.name ?? "Unknown";
  const txs = db.transactions.filter((t) => t.periodLabel === CURRENT_PERIOD.label);
  const pendingApproval = db.payouts.filter((p) => p.periodId === CURRENT_PERIOD.id && p.status === "pending");
  const by = (s: string) => txs.filter((t) => t.status === s);
  const completed = by("completed");
  const processing = by("processing");
  const failed = by("failed");
  const list = (ids: string[]) => ids.map(name).join(", ");

  if (txs.length === 0 && pendingApproval.length === 0) return "There are no payouts for this period yet.";
  switch (query) {
    case "failed":
      return failed.length ? `${failed.length} payment${failed.length === 1 ? "" : "s"} failed: ${list(failed.map((t) => t.workerId))}.` : "No payments have failed.";
    case "completed":
      return `${completed.length} payment${completed.length === 1 ? " is" : "s are"} completed.`;
    case "pending": {
      const waiting = [...pendingApproval.map((p) => p.workerId), ...processing.map((t) => t.workerId)];
      return waiting.length
        ? `${pendingApproval.length} awaiting your approval and ${processing.length} processing: ${list(waiting)}.`
        : "Nothing is pending.";
    }
    default: {
      const parts = [`${completed.length} completed`, `${processing.length} processing`, `${failed.length} failed`];
      const waiting = pendingApproval.length ? `, and ${pendingApproval.length} awaiting approval` : "";
      return `This period: ${parts.join(", ")}${waiting}.`;
    }
  }
}

/** Resolves and validates the model's raw intent into an action plan. Never executes anything. */
export function resolveIntent(raw: RawIntent): IntentPlan {
  const db = getDb();

  switch (raw.intent) {
    case "mark_attendance":
    case "record_overtime":
    case "record_units": {
      const m = findWorker(raw.workerName, db.workers);
      if ("question" in m) return { kind: "clarify", question: m.question };
      const d = resolveDate(raw.date);
      if ("reason" in d) return { kind: "unknown", reason: d.reason };
      const base = { workerId: m.worker.id, workerName: m.worker.name, date: d.date };
      if (raw.intent === "mark_attendance") {
        if (!raw.attendanceStatus) return { kind: "clarify", question: `Should I mark ${m.worker.name} present, absent, half day or on leave?` };
        return { kind: "mark", ...base, status: raw.attendanceStatus };
      }
      if (raw.intent === "record_overtime") {
        if (raw.hours === null) return { kind: "clarify", question: `How many overtime hours for ${m.worker.name}?` };
        if (raw.hours < 0 || raw.hours > 24) return { kind: "unknown", reason: "Overtime must be between 0 and 24 hours." };
        return { kind: "overtime", ...base, hours: raw.hours };
      }
      if (raw.units === null) return { kind: "clarify", question: `How many units did ${m.worker.name} complete?` };
      if (raw.units < 0 || raw.units > 100_000) return { kind: "unknown", reason: "That unit count doesn't look right." };
      return { kind: "units", ...base, units: Math.round(raw.units) };
    }

    case "approve_payouts":
    case "reject_payouts": {
      const kind = raw.intent === "approve_payouts" ? "approve" : "reject";
      const pending = db.payouts.filter((p) => p.status === "pending");
      if (raw.allWorkers) {
        if (pending.length === 0) return { kind: "answer", text: "There are no pending payouts to act on." };
        return { kind, workerId: null, workerName: null };
      }
      const m = findWorker(raw.workerName, db.workers);
      if ("question" in m) return { kind: "clarify", question: m.question };
      if (!pending.some((p) => p.workerId === m.worker.id)) {
        return { kind: "answer", text: `${m.worker.name} has no payout waiting for approval.` };
      }
      return { kind, workerId: m.worker.id, workerName: m.worker.name };
    }

    case "prepare_incentives": {
      const warnings: string[] = [];
      let city: string | null = null;
      if (raw.city) {
        const q = norm(raw.city);
        const known = [...new Set(db.workers.filter((w) => w.status === "active").map((w) => w.city))];
        city = known.find((c) => norm(c) === q) ?? known.find((c) => norm(c).includes(q) || q.includes(norm(c))) ?? null;
        if (!city) return { kind: "answer", text: `I couldn't find any workers in ${raw.city}.` };
      }
      let date: string | null = null;
      if (raw.minimumUnits !== null) {
        const d = resolveDate(raw.date);
        if ("reason" in d) return { kind: "unknown", reason: d.reason };
        date = d.date;
        warnings.push(`Only workers with at least ${raw.minimumUnits} deliveries on ${date} are included. Their payout is the full period amount from the rules engine.`);
      }
      if (city) warnings.push(`Only workers in ${city} are included.`);
      warnings.push("Amounts come from the incentive rules (tiers on the Incentives screen), not from the command. Workers with missing or conflicting records are flagged Needs Review automatically.");
      warnings.push("One command does one action. Say anything else (like marking attendance) as a separate command.");
      return { kind: "prepare", warnings, filter: { city, minUnits: raw.minimumUnits, date } };
    }

    case "payout_status":
      return { kind: "answer", text: statusAnswer(raw.statusQuery) };

    case "navigate": {
      const page = PAGES.find((p) => p.key === raw.page);
      return page ? { kind: "navigate", to: page.to, label: page.label } : { kind: "clarify", question: "Which screen should I open?" };
    }

    case "clarify":
      return { kind: "clarify", question: raw.clarificationQuestion ?? "Could you say that again with a bit more detail?" };

    default:
      return { kind: "unknown", reason: "I can mark attendance, record overtime or units, prepare and approve payouts, and report payout status." };
  }
}

export async function planFromText(text: string, context?: IntentContext): Promise<IntentPlan> {
  const db = getDb();
  const raw = await extractIntent({
    text,
    context,
    today: TODAY,
    periodStart: CURRENT_PERIOD.start,
    periodEnd: CURRENT_PERIOD.end,
    workerNames: db.workers.filter((w) => w.status === "active").map((w) => w.name),
  });
  const plan = resolveIntent(raw);
  if (plan.kind === "clarify") {
    // The model wrote clarifying questions in the manager's language; ones we generate are English.
    return { ...plan, language: raw.intent === "clarify" ? raw.language : "en" };
  }
  if (plan.kind === "answer" && raw.language !== "en") {
    const translated = await translateReply(plan.text, raw.language);
    if (translated) return { ...plan, text: translated, language: raw.language };
  }
  return plan;
}
