import type { AttendanceStatus } from "./types";

/**
 * A fully resolved, validated action the UI can show for confirmation.
 * Produced by the server (/api/intent) or by the offline fallback parser.
 * It never contains amounts: pay is always computed by the backend engine.
 */
export type IntentPlan =
  | { kind: "mark"; workerId: string; workerName: string; status: AttendanceStatus; date: string }
  | { kind: "overtime"; workerId: string; workerName: string; hours: number; date: string }
  | { kind: "units"; workerId: string; workerName: string; units: number; date: string }
  | { kind: "approve" | "reject"; workerId: string | null; workerName: string | null }
  | { kind: "prepare"; warnings: string[] }
  | { kind: "navigate"; to: string; label: string }
  | { kind: "answer"; text: string; language?: string }
  | { kind: "clarify"; question: string; language?: string }
  | { kind: "unknown"; reason: string };

/** Pages the assistant may navigate to. */
export const PAGES = [
  { key: "dashboard", to: "/dashboard", label: "Dashboard" },
  { key: "workers", to: "/workers", label: "Workers" },
  { key: "attendance", to: "/attendance", label: "Attendance" },
  { key: "incentives", to: "/incentives", label: "Incentives" },
  { key: "payouts", to: "/payouts", label: "Payouts" },
  { key: "transactions", to: "/transactions", label: "Transactions" },
] as const;

export interface IntentContext {
  /** The user's previous message, when it prompted a clarifying question. */
  previousText: string;
  /** The clarifying question that was asked. */
  question: string;
}
