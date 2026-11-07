import "server-only";
import type { SessionState, TurnOutcome } from "./types";

export interface TurnMetric {
  at: number;
  sessionId: string;
  stateBefore: SessionState;
  outcome: TurnOutcome;
  /** Time spent waiting on the language model for this turn (0 when none was needed). */
  llmMs: number;
  llmCalls: number;
  steps: number;
  language: string;
  /** Confirmed or cancelled by the deterministic phrase list, without the model. */
  fastPath: boolean;
  dryRun: boolean;
  /** Planner model that served the turn (shows rate-limit failovers). */
  model?: string;
}

const g = globalThis as unknown as { __voiceMetrics?: TurnMetric[] };
const MAX = 2000;

export function recordTurn(m: Omit<TurnMetric, "at">) {
  const list = (g.__voiceMetrics ??= []);
  list.push({ at: Date.now(), ...m });
  if (list.length > MAX) list.splice(0, list.length - MAX);
}

const pct = (sorted: number[], p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0);

export function metricsSummary(opts: { includeDryRun?: boolean } = {}) {
  const all = (g.__voiceMetrics ?? []).filter((m) => opts.includeDryRun !== false || !m.dryRun);
  const byOutcome: Record<string, number> = {};
  for (const m of all) byOutcome[m.outcome] = (byOutcome[m.outcome] ?? 0) + 1;
  const llm = all.filter((m) => m.llmMs > 0).map((m) => m.llmMs).sort((a, b) => a - b);
  const planning = all.filter((m) => ["answered", "clarified", "planned", "checkpoint", "rejected", "superseded", "executed"].includes(m.outcome) && m.llmCalls > 0);
  const clarified = byOutcome.clarified ?? 0;
  const confirms = all.filter((m) => m.stateBefore === "confirming");
  const n = (x: number) => Math.round(x * 1000) / 1000;
  return {
    turns: all.length,
    byOutcome,
    llm: { turns: llm.length, p50Ms: pct(llm, 50), p95Ms: pct(llm, 95), calls: all.reduce((s, m) => s + m.llmCalls, 0) },
    clarificationRate: planning.length ? n(clarified / planning.length) : 0,
    errorRate: all.length ? n((byOutcome.error ?? 0) / all.length) : 0,
    supersedeRate: all.length ? n((byOutcome.superseded ?? 0) / all.length) : 0,
    fastPathShareOfConfirmations: confirms.length ? n(confirms.filter((m) => m.fastPath).length / confirms.length) : 0,
    avgStepsPerPlan: n(planning.filter((m) => m.steps > 0).reduce((s, m) => s + m.steps, 0) / Math.max(1, planning.filter((m) => m.steps > 0).length)),
    byModel: all.reduce<Record<string, number>>((acc, m) => (m.model ? ((acc[m.model] = (acc[m.model] ?? 0) + 1), acc) : acc), {}),
    languages: all.reduce<Record<string, number>>((acc, m) => ((acc[m.language] = (acc[m.language] ?? 0) + 1), acc), {}),
  };
}

export function resetMetrics() {
  g.__voiceMetrics = [];
}
