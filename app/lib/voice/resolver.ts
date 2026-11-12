import "server-only";
import { formatDate } from "@/app/lib/merchant/format";
import { getToday } from "@/app/lib/server/context";
import { CATALOG, slotValues, type SlotDef } from "./catalog";
import { resolveDate, resolveSelector } from "./selectors";
import type { Args, RawStep, ResolvedStep, Selector } from "./types";

export type Resolution =
  | { kind: "ok"; steps: ResolvedStep[] }
  | { kind: "clarify"; question: string; stepIndex: number }
  | { kind: "reject"; reason: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Structural check of the planner's selector object. */
export function cleanSelector(v: unknown): Selector | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const scope = ["all", "names", "city", "filter"].includes(o.scope as string) ? (o.scope as Selector["scope"]) : null;
  if (!scope) return null;
  const strs = (x: unknown) => (Array.isArray(x) ? x.filter((n): n is string => typeof n === "string" && n.trim() !== "").map((n) => n.trim().slice(0, 80)).slice(0, 60) : []);
  return {
    scope,
    names: strs(o.names),
    city: typeof o.city === "string" && o.city.trim() ? o.city.trim().slice(0, 60) : null,
    except: strs(o.except),
    filter: typeof o.filter === "string" && o.filter in CATALOG.selectorFilters ? o.filter : null,
    minUnits: typeof o.minUnits === "number" && Number.isFinite(o.minUnits) && o.minUnits >= 0 ? o.minUnits : null,
  };
}

/** Keeps only the slots an action defines and drops anything the model made up. */
export function normalizeRawSteps(steps: unknown): RawStep[] {
  if (!Array.isArray(steps)) return [];
  const out: RawStep[] = [];
  for (const s of steps.slice(0, 12)) {
    if (!s || typeof s !== "object") continue;
    const action = (s as { action?: unknown }).action;
    if (typeof action !== "string" || !(action in CATALOG.actions)) continue;
    const def = CATALOG.actions[action];
    const rawArgs = ((s as { args?: unknown }).args ?? {}) as Record<string, unknown>;
    const args: Args = {};
    for (const [k, slot] of Object.entries(def.slots)) {
      const v = rawArgs[k];
      args[k] = slot.type === "workerSelector" ? cleanSelector(v) : v === undefined ? null : v;
    }
    out.push({ action, args });
  }
  return out;
}

function coerce(slot: SlotDef, v: unknown): { value: unknown } | { missing: true } | { error: string } {
  if (v === null || v === undefined || v === "") return { missing: true };
  switch (slot.type) {
    case "enum": {
      const ok = slotValues(slot)?.includes(String(v));
      return ok ? { value: String(v) } : { missing: true };
    }
    case "number": {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) return { missing: true };
      if ((slot.min !== undefined && n < slot.min) || (slot.max !== undefined && n > slot.max)) return { error: "That number doesn't look right." };
      return { value: n };
    }
    case "email":
      return EMAIL.test(String(v).trim()) ? { value: String(v).trim() } : { error: "That email doesn't look valid." };
    case "string":
      return String(v).trim() ? { value: String(v).trim().slice(0, 120) } : { missing: true };
    default:
      return { value: v };
  }
}

function fill(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

/**
 * Validates every step against real records and either returns executable steps, one clarifying
 * question, or a rejection. Pure with respect to the database (reads only).
 */
export function resolveSteps(raw: RawStep[]): Resolution {
  const steps: ResolvedStep[] = [];
  for (let i = 0; i < raw.length; i++) {
    const { action, args } = raw[i];
    const def = CATALOG.actions[action];
    const resolved: Args = {};
    const vars: Record<string, string> = {};

    // Date first: selectors with minUnits or attendance filters depend on it.
    const dateSlot = def.slots.date;
    let date = getToday();
    if (dateSlot) {
      const r = resolveDate(args.date, { withinPeriod: def.changesPayData === true && action !== "query" });
      if ("error" in r) return { kind: "reject", reason: r.error };
      date = r.date;
      resolved.date = date;
      vars.date = date === getToday() ? "today" : `on ${formatDate(date)}`;
    }

    for (const [key, slot] of Object.entries(def.slots)) {
      if (key === "date") continue;
      if (slot.type === "workerSelector") {
        const sel = (args[key] as Selector | null) ?? null;
        if (!sel && slot.required) return { kind: "clarify", question: slot.ask ?? "Which workers?", stepIndex: i };
        const r = resolveSelector(sel, {
          date,
          defaultAll: !slot.required,
          includeInactive: action === "update_worker",
          allLabel: action === "approve_payouts" || action === "reject_payouts" ? "all pending payouts" : action === "retry_failed" ? "all failed payments" : undefined,
        });
        if ("clarify" in r) return { kind: "clarify", question: r.clarify, stepIndex: i };
        if (r.workers.length === 0 && action !== "query") return { kind: "reject", reason: `Nobody matches ${sel ? "that selection" : "that"}, so there is nothing to do for "${def.summary.split(" {")[0]}".` };
        if (action === "update_worker" && r.workers.length > 1) return { kind: "clarify", question: "I can update one worker at a time. Which worker?", stepIndex: i };
        resolved[key] = sel;
        resolved.workerIds = r.workers.map((w) => w.id);
        vars[key] = r.label;
        continue;
      }
      const c = coerce(slot, args[key]);
      if ("error" in c) {
        if (slot.type === "email") return { kind: "clarify", question: `${c.error} ${slot.ask ?? "Could you say it again?"}`, stepIndex: i };
        return { kind: "reject", reason: c.error };
      }
      if ("missing" in c) {
        if (slot.required) return { kind: "clarify", question: slot.ask ?? `What is the ${key}?`, stepIndex: i };
        resolved[key] = null;
        vars[key] = "";
        continue;
      }
      resolved[key] = c.value;
      vars[key] = String(c.value);
    }

    // update_worker: validate the value for the chosen field.
    if (action === "update_worker") {
      const field = resolved.field as string;
      const value = String(resolved.value);
      if (field === "dailyWage") {
        const n = Number(value.replace(/[^\d.]/g, ""));
        if (!Number.isFinite(n) || n <= 0 || n > 100000) return { kind: "clarify", question: "What daily wage in rupees?", stepIndex: i };
        resolved.value = String(n);
        vars.value = `₹${n}`;
      } else if (field === "payoutEmail") {
        if (!EMAIL.test(value)) return { kind: "clarify", question: "That email doesn't look valid. What is the PayPal email?", stepIndex: i };
      } else if (field === "status") {
        const v = value.toLowerCase();
        if (!["active", "inactive"].includes(v)) return { kind: "clarify", question: "Should the worker be active or inactive?", stepIndex: i };
        resolved.value = v;
      }
    }
    if (action === "set_rule") {
      const key = resolved.ruleKey as string;
      const n = resolved.amount as number;
      if (key === "attendanceThreshold" && n > 1) return { kind: "reject", reason: "The attendance threshold must be between 0 and 1." };
      if (key === "workingHoursPerDay" && n <= 0) return { kind: "reject", reason: "Working hours per day must be above zero." };
    }

    steps.push({ action, args: resolved, summary: fill(def.summary, vars), risk: def.risk });
  }
  return { kind: "ok", steps };
}
