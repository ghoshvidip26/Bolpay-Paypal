import "server-only";
import { formatDate } from "@/app/lib/merchant/format";
import { getPeriod, getToday } from "@/app/lib/server/context";
import type { Worker } from "@/app/lib/merchant/types";
import { getDb } from "@/app/lib/server/db";
import type { Selector } from "./types";

export const norm = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Every worker a spoken name could mean. Exact match wins; otherwise partial matches. */
export function matchWorker(name: string, pool: Worker[]): Worker[] {
  const q = norm(name);
  if (!q) return [];
  const exact = pool.filter((w) => norm(w.name) === q);
  if (exact.length) return exact;
  const qTokens = q.split(" ");
  return pool.filter((w) => {
    const full = norm(w.name);
    if (full.includes(q) || q.includes(full)) return true;
    return full.split(" ").some((p) => p.length > 2 && qTokens.includes(p));
  });
}

export type SelResult = { workers: Worker[]; label: string } | { clarify: string };

export interface SelOptions {
  /** Date used by minUnits and attendance filters. */
  date: string;
  /** When the selector is null: everyone active (true) or ask (false). */
  defaultAll: boolean;
  includeInactive?: boolean;
  /** Label used when everyone is meant, e.g. "all pending payouts". */
  allLabel?: string;
}

function knownCities(): string[] {
  return [...new Set(getDb().workers.filter((w) => w.status === "active").map((w) => w.city).filter(Boolean))];
}

export function matchCity(name: string): string | null {
  const q = norm(name);
  const cities = knownCities();
  return cities.find((c) => norm(c) === q) ?? cities.find((c) => norm(c).includes(q) || q.includes(norm(c))) ?? null;
}

const listNames = (ws: Worker[]) => (ws.length <= 4 ? ws.map((w) => w.name).join(", ") : `${ws.length} workers`);

/** Resolves a spoken target into real worker records. Never trusts the model for who is included. */
export function resolveSelector(sel: Selector | null, o: SelOptions): SelResult {
  const db = getDb();
  const pool = db.workers.filter((w) => o.includeInactive || w.status === "active");
  let picked: Worker[];
  let label: string;
  /** For group scopes the label is rebuilt at the end so the count reflects every narrowing step. */
  let noun: string | null = null;

  if (!sel) {
    if (!o.defaultAll) return { clarify: "Which workers do you mean?" };
    picked = pool;
    label = o.allLabel ?? `all ${pool.length} active workers`;
    noun = o.allLabel ? null : "active workers";
  } else if (sel.scope === "names") {
    if (sel.names.length === 0) return { clarify: "Which workers do you mean?" };
    picked = [];
    for (const name of sel.names) {
      const hits = matchWorker(name, pool);
      if (hits.length === 0) return { clarify: `I couldn't find a worker called "${name}". Who did you mean?` };
      if (hits.length > 1) return { clarify: `Which one do you mean by "${name}": ${hits.map((w) => w.name).join(" or ")}?` };
      if (!picked.includes(hits[0])) picked.push(hits[0]);
    }
    label = listNames(picked);
  } else if (sel.scope === "city") {
    if (!sel.city) return { clarify: "Which city?" };
    const city = matchCity(sel.city);
    if (!city) return { clarify: `I don't have any workers in ${sel.city}. Which city did you mean?` };
    picked = pool.filter((w) => w.city === city);
    label = `${picked.length} workers in ${city}`;
    noun = `workers in ${city}`;
  } else if (sel.scope === "filter") {
    const f = sel.filter;
    if (!f) return { clarify: "Which workers do you mean?" };
    const active = pool;
    const hasRecord = (w: Worker) => db.attendance.some((r) => r.workerId === w.id && r.date === o.date);
    if (f === "missing_attendance" || f === "not_marked_today") picked = active.filter((w) => !hasRecord(w));
    else if (f === "failed_payment") {
      const ids = new Set(db.transactions.filter((t) => t.status === "failed" && t.periodLabel === getPeriod().label).map((t) => t.workerId));
      picked = active.filter((w) => ids.has(w.id));
    } else if (f === "pending_payout") {
      const ids = new Set(db.payouts.filter((p) => p.status === "pending").map((p) => p.workerId));
      picked = active.filter((w) => ids.has(w.id));
    } else if (f === "needs_review") {
      const ids = new Set(db.payouts.filter((p) => p.status === "needs_review").map((p) => p.workerId));
      picked = active.filter((w) => ids.has(w.id));
    } else return { clarify: "Which workers do you mean?" };
    label = `${picked.length} workers (${f.replace(/_/g, " ")})`;
    noun = `workers (${f.replace(/_/g, " ")})`;
  } else {
    picked = pool;
    label = o.allLabel ?? `all ${pool.length} active workers`;
    noun = o.allLabel ? null : "active workers";
    if (sel.city) {
      const city = matchCity(sel.city);
      if (!city) return { clarify: `I don't have any workers in ${sel.city}. Which city did you mean?` };
      picked = pool.filter((w) => w.city === city);
      label = `all ${picked.length} workers in ${city}`;
      noun = `workers in ${city}`;
    }
  }

  // Extra narrowing that applies to any scope.
  if (sel?.scope !== "names" && sel?.city && sel.scope !== "city" && sel.scope !== "all") {
    const city = matchCity(sel.city);
    if (city) picked = picked.filter((w) => w.city === city);
  }
  if (sel?.except?.length) {
    const drop = new Set<string>();
    for (const n of sel.except) matchWorker(n, picked).forEach((w) => drop.add(w.id));
    if (drop.size) {
      picked = picked.filter((w) => !drop.has(w.id));
      label = `${label} except ${sel.except.join(", ")}`;
      if (noun) noun = `${noun} except ${sel.except.join(", ")}`;
    }
  }
  if (sel?.minUnits != null) {
    const min = sel.minUnits;
    picked = picked.filter((w) => {
      const r = db.attendance.find((x) => x.workerId === w.id && x.date === o.date);
      return !!r && (r.status === "present" || r.status === "half") && r.units >= min;
    });
    const when = o.date === getToday() ? "today" : `on ${formatDate(o.date)}`;
    label = noun ? `${picked.length} ${noun} with at least ${min} deliveries ${when}` : `${label} with at least ${min} deliveries ${when}`;
  } else if (noun && sel?.scope !== "names") {
    label = `${sel?.scope === "all" || !sel ? "all " : ""}${picked.length} ${noun}`;
  }
  return { workers: picked, label };
}

/** Validates a date slot. Null means today. */
export function resolveDate(v: unknown, opts: { withinPeriod: boolean }): { date: string } | { error: string } {
  if (v === null || v === undefined || v === "") return { date: getToday() };
  const d = String(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) return { error: "I couldn't understand that date." };
  if (d > getToday()) return { error: "That date is in the future." };
  if (opts.withinPeriod && d < getPeriod().start) return { error: `That date is before the current pay period (${getPeriod().label}).` };
  return { date: d };
}
