export type WorkerStatus = "active" | "inactive";

export interface Worker {
  id: string;
  name: string;
  role: string;
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
  attendanceBonus: number;
  total: number;
}

export interface Period {
  id: string;
  label: string;
  start: string;
  end: string;
}

export type PayoutStatus = "pending" | "approved" | "rejected";

export interface Payout {
  id: string;
  workerId: string;
  periodId: string;
  periodLabel: string;
  breakdown: PayBreakdown;
  amount: number;
  status: PayoutStatus;
  submittedAt: string; // ISO
  decidedAt?: string;
}

export type TransactionStatus = "processing" | "completed" | "failed";

export interface Transaction {
  id: string;
  payoutId: string;
  workerId: string;
  periodLabel: string;
  amount: number;
  status: TransactionStatus;
  createdAt: string; // ISO
  reference: string;
  failureReason?: string;
}
