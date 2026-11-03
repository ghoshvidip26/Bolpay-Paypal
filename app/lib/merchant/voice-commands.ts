import type { AttendanceStatus, Worker } from "./types";

export type VoiceIntent =
  | { kind: "mark"; worker: Worker; status: AttendanceStatus }
  | { kind: "overtime"; worker: Worker; hours: number }
  | { kind: "units"; worker: Worker; units: number }
  | { kind: "approve"; worker: Worker | null } // null = all pending
  | { kind: "reject"; worker: Worker | null }
  | { kind: "navigate"; to: string; label: string }
  | { kind: "unknown"; reason: string };

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

/** Turns a free-form transcript into a structured intent. English only for now. */
export function parseVoiceCommand(raw: string, workers: Worker[]): VoiceIntent {
  const text = raw.toLowerCase().replace(/[.,!?]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return { kind: "unknown", reason: "I didn't catch anything." };

  const worker = findWorker(text, workers);

  if (/\b(approve|accept)\b/.test(text)) {
    if (/\ball\b|\beveryone\b|\bevery\b/.test(text)) return { kind: "approve", worker: null };
    if (worker) return { kind: "approve", worker };
    return { kind: "unknown", reason: "Who should I approve? Say a worker's name or “approve all”." };
  }
  if (/\b(reject|decline|deny)\b/.test(text)) {
    if (/\ball\b|\beveryone\b/.test(text)) return { kind: "reject", worker: null };
    if (worker) return { kind: "reject", worker };
    return { kind: "unknown", reason: "Who should I reject? Say a worker's name or “reject all”." };
  }

  if (/\bovertime\b|\bextra hours?\b|\bworked .* hours?\b/.test(text)) {
    const hours = findNumber(text);
    if (!worker) return { kind: "unknown", reason: "Which worker did the overtime?" };
    if (hours === null) return { kind: "unknown", reason: `How many overtime hours for ${worker.name}?` };
    return { kind: "overtime", worker, hours };
  }

  if (/\b(units?|orders?|tasks?|items?)\b/.test(text) && /\b(completed?|did|finished|packed|delivered|sold)\b/.test(text)) {
    const units = findNumber(text.replace(worker?.name.toLowerCase() ?? "", ""));
    if (!worker) return { kind: "unknown", reason: "Which worker completed those?" };
    if (units === null) return { kind: "unknown", reason: `How many units did ${worker.name} complete?` };
    return { kind: "units", worker, units };
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
    return { kind: "mark", worker, status };
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

export function describeIntent(i: VoiceIntent, today: string): string {
  switch (i.kind) {
    case "mark":
      return `Mark ${i.worker.name} as ${i.status === "half" ? "half day" : i.status} on ${today}`;
    case "overtime":
      return `Record ${i.hours}h overtime for ${i.worker.name} on ${today}`;
    case "units":
      return `Record ${i.units} units completed by ${i.worker.name} on ${today}`;
    case "approve":
      return i.worker ? `Approve ${i.worker.name}'s pending payout` : "Approve all pending payouts";
    case "reject":
      return i.worker ? `Reject ${i.worker.name}'s pending payout` : "Reject all pending payouts";
    case "navigate":
      return `Open ${i.label}`;
    case "unknown":
      return i.reason;
  }
}
