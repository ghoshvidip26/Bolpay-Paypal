/** Shared types for the voice assistant (server side). */

export type Risk = "read" | "write" | "money";

export interface Selector {
  scope: "all" | "names" | "city" | "filter";
  names: string[];
  city: string | null;
  except: string[];
  filter: string | null;
  minUnits: number | null;
}

export type Args = Record<string, unknown>;

/** A step exactly as the planner (LLM) produced it, after structural validation only. */
export interface RawStep {
  action: string;
  args: Args;
}

export interface PlannerOutput {
  language: string;
  /** Only meaningful while a clarifying question is pending: did the reply answer it? */
  answersPending: boolean | null;
  steps: RawStep[];
  notUnderstood: string | null;
}

/** Snapshot of the money a step will move, shown to the manager before PayPal is called. */
export interface MoneyPreview {
  count: number;
  totalInr: number;
  totalUsd: number;
  names: string[];
  skipped: string[];
}

/** A step whose slots have all been validated against real records. */
export interface ResolvedStep {
  action: string;
  args: Args;
  summary: string;
  risk: Risk;
  /** For money steps: the exact figures the manager confirmed. Execution refuses to run if reality differs. */
  expect?: MoneyPreview;
}

export type StepStatus = "pending" | "done" | "skipped" | "failed" | "not_run";

export interface StepView {
  action: string;
  summary: string;
  risk: Risk;
  status: StepStatus;
  message?: string;
}

export type SessionState = "idle" | "clarifying" | "confirming";

export type TurnOutcome =
  | "answered"
  | "clarified"
  | "planned"
  | "checkpoint"
  | "executed"
  | "cancelled"
  | "superseded"
  | "rejected"
  | "error";

export interface TurnView {
  sessionId: string;
  state: SessionState;
  outcome: TurnOutcome;
  /** What to say out loud. Short. */
  speech: string;
  /** Fuller lines for the screen. */
  lines: string[];
  steps: StepView[];
  awaiting: "reply" | "confirm" | null;
  /** Set when a navigate step ran. */
  navigate?: string;
  language: string;
  dryRun: boolean;
  /** True when the pending confirmation is a money checkpoint with exact figures. */
  checkpoint?: boolean;
}
