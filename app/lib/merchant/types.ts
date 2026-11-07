export type WorkerStatus = "active" | "inactive";

export interface Worker {
  id: string;
  name: string;
  role: string;
  /** City the worker operates in (used by voice/batch filters). */
  city: string;
  phone: string;
  /** PayPal account used for payouts. Empty = payouts will fail. */
  payoutEmail: string;
  dailyWage: number;
  joinedOn: string; // YYYY-MM-DD
  status: WorkerStatus;
}

export type AttendanceStatus = "present" | "half" | "absent" | "leave";

export interface AttendanceRecord {
  workerId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  overtimeHours: number;
  /** Units of work completed that day (orders, tasks, items...). */
  units: number;
}

export interface IncentiveRules {
  workingHoursPerDay: number;
  overtimeMultiplier: number;
  /** Units per day before the per-unit incentive starts. */
  dailyUnitTarget: number;
  ratePerExtraUnit: number;
  /** 0-1, share of period days a worker must be paid-present for. */
  attendanceThreshold: number;
  attendanceBonus: number;
  /** Daily delivery tiers: on each worked day the highest tier reached is paid once. */
  deliveryTiers: DeliveryTier[];
  /** Bumped every time the rules change; stored on each payout for auditability. */
  version: number;
}

export interface DeliveryTier {
  minUnits: number;
  bonus: number;
}

export interface PayBreakdown {
  workerId: string;
  periodDays: number;
  payDays: number;
  overtimeHours: number;
  extraUnits: number;
  attendanceRate: number;
  basePay: number;
  overtimePay: number;
  performanceIncentive: number;
  /** Sum of daily delivery-tier bonuses. */
  tierBonus: number;
  attendanceBonus: number;
  total: number;
}

export interface Period {
  id: string;
  label: string;
  start: string;
  end: string;
}

export type PayoutStatus = "pending" | "needs_review" | "approved" | "rejected";

export interface Payout {
  id: string;
  workerId: string;
  periodId: string;
  periodLabel: string;
  breakdown: PayBreakdown;
  amount: number;
  status: PayoutStatus;
  /** Rule set used to compute this payout. */
  ruleVersion?: number;
  rulesSnapshot?: IncentiveRules;
  /** Why a payout is flagged Needs Review (missing or conflicting records). */
  reviewReasons?: string[];
  submittedAt: string; // ISO
  decidedAt?: string;
}

export type TransactionStatus = "processing" | "completed" | "failed";

export interface Transaction {
  id: string;
  payoutId: string;
  workerId: string;
  periodLabel: string;
  /** Amount in the app's display currency (INR). */
  amount: number;
  /** Amount actually sent to PayPal (USD in the sandbox) and the rate used. */
  usdAmount?: number;
  fxRate?: number;
  status: TransactionStatus;
  createdAt: string; // ISO
  reference: string;
  failureReason?: string;
  /** PayPal payout batch this transaction was submitted in (absent until submitted). */
  batchId?: string;
  /** How many times this payout has been submitted (retries increment it). */
  attempt?: number;
}
