import type { IntentPlan } from "./intent-types";
import type { AttendanceStatus, Worker } from "./types";

/**
 * Offline fallback parser (English only, keyword based). The assistant uses /api/intent first and
 * only falls back to this when the AI service is unavailable.
 */

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30,
};

function findNumber(text: string): number | null {
  const digit = text.match(/(\d+(?:\.\d+)?)/);
  if (digit) return Number(digit[1]);
  if (/\bhalf an? hour\b/.test(text)) return 0.5;
  for (const word of text.split(/\s+/)) if (word in NUMBER_WORDS) return NUMBER_WORDS[word];
  return null;
}

function findWorker(text: string, workers: Worker[]): Worker | null {
  const active = workers.filter((w) => w.status === "active");
  // Full name first, then any name part longer than 2 chars.
  const full = active.find((w) => text.includes(w.name.toLowerCase()));
  if (full) return full;
  const parts = active.filter((w) =>
    w.name
      .toLowerCase()
      .split(" ")
      .some((p) => p.length > 2 && new RegExp(`\\b${p}\\b`).test(text)),
  );
  return parts.length === 1 ? parts[0] : null;
}

const PAGES: { match: RegExp; to: string; label: string }[] = [
  { match: /\b(dashboard|home|overview)\b/, to: "/dashboard", label: "Dashboard" },
  { match: /\bworkers?|staff|employees?\b/, to: "/workers", label: "Workers" },
  { match: /\battendance\b/, to: "/attendance", label: "Attendance" },
  { match: /\bincentives?\b/, to: "/incentives", label: "Incentives" },
  { match: /\btransactions?\b/, to: "/transactions", label: "Transactions" },
  { match: /\bpayouts?|approvals?\b/, to: "/payouts", label: "Payouts" },
];

export function parseVoiceCommand(raw: string, workers: Worker[], today: string): IntentPlan {
  const text = raw.toLowerCase().replace(/[.,!?]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return { kind: "unknown", reason: "I didn't catch anything." };

  const worker = findWorker(text, workers);

  if (/\b(approve|accept)\b/.test(text)) {
    if (/\ball\b|\beveryone\b|\bevery\b/.test(text)) return { kind: "approve", workerId: null, workerName: null };
    if (worker) return { kind: "approve", workerId: worker.id, workerName: worker.name };
    return { kind: "unknown", reason: "Who should I approve? Say a worker's name or “approve all”." };
  }
  if (/\b(reject|decline|deny)\b/.test(text)) {
    if (/\ball\b|\beveryone\b/.test(text)) return { kind: "reject", workerId: null, workerName: null };
    if (worker) return { kind: "reject", workerId: worker.id, workerName: worker.name };
    return { kind: "unknown", reason: "Who should I reject? Say a worker's name or “reject all”." };
  }

  if (/\bovertime\b|\bextra hours?\b|\bworked .* hours?\b/.test(text)) {
    const hours = findNumber(text);
    if (!worker) return { kind: "unknown", reason: "Which worker did the overtime?" };
    if (hours === null) return { kind: "unknown", reason: `How many overtime hours for ${worker.name}?` };
    return { kind: "overtime", workerId: worker.id, workerName: worker.name, hours, date: today };
  }

  if (/\b(units?|orders?|tasks?|items?)\b/.test(text) && /\b(completed?|did|finished|packed|delivered|sold)\b/.test(text)) {
    const units = findNumber(text.replace(worker?.name.toLowerCase() ?? "", ""));
    if (!worker) return { kind: "unknown", reason: "Which worker completed those?" };
    if (units === null) return { kind: "unknown", reason: `How many units did ${worker.name} complete?` };
    return { kind: "units", workerId: worker.id, workerName: worker.name, units, date: today };
  }

  const status: AttendanceStatus | null = /\bhalf[- ]?day\b|\bhalf\b/.test(text)
    ? "half"
    : /\b(absent|not here|didn'?t come|no show)\b/.test(text)
      ? "absent"
      : /\b(leave|vacation|sick)\b/.test(text)
        ? "leave"
        : /\b(present|here|came|arrived|in today|attended)\b/.test(text)
          ? "present"
          : null;
  if (status) {
    if (!worker) return { kind: "unknown", reason: "Which worker? Try “mark Ravi present”." };
    return { kind: "mark", workerId: worker.id, workerName: worker.name, status, date: today };
  }

  if (/\b(go to|open|show|take me to|navigate)\b/.test(text)) {
    const page = PAGES.find((p) => p.match.test(text));
    if (page) return { kind: "navigate", to: page.to, label: page.label };
  }

  return {
    kind: "unknown",
    reason: "Try “mark Ravi present”, “Anita worked 2 hours overtime”, “approve all payouts” or “open attendance”.",
  };
}

export function describePlan(p: IntentPlan): string {
  switch (p.kind) {
    case "mark":
      return `Mark ${p.workerName} as ${p.status === "half" ? "half day" : p.status} on ${p.date}`;
    case "overtime":
      return `Record ${p.hours}h overtime for ${p.workerName} on ${p.date}`;
    case "units":
      return `Record ${p.units} units completed by ${p.workerName} on ${p.date}`;
    case "approve":
      return p.workerName ? `Approve ${p.workerName}'s pending payout` : "Approve all pending payouts";
    case "reject":
      return p.workerName ? `Reject ${p.workerName}'s pending payout` : "Reject all pending payouts";
    case "prepare":
      return "Calculate this period's incentives and queue payouts for approval";
    case "navigate":
      return `Open ${p.label}`;
    case "answer":
      return p.text;
    case "clarify":
      return p.question;
    case "unknown":
      return p.reason;
  }
}

/** Plans that only show text and have nothing to confirm. */
export const isInformational = (p: IntentPlan) => p.kind === "answer" || p.kind === "clarify" || p.kind === "unknown";
