import { dateRange } from "./format";
import type { AttendanceRecord, Payout, Period, Transaction, Worker } from "./types";
import { calculatePay, DEFAULT_RULES } from "./incentives";

/** Fixed "today" so server and client renders agree while there is no backend. */
export const TODAY = "2026-11-03";

export const CURRENT_PERIOD: Period = {
  id: "2026-p22",
  label: "Oct 21 – Nov 3, 2026",
  start: "2026-10-21",
  end: "2026-11-03",
};

const PREVIOUS_PERIOD: Period = {
  id: "2026-p21",
  label: "Oct 7 – Oct 20, 2026",
  start: "2026-10-07",
  end: "2026-10-20",
};

export const SEED_WORKERS: Worker[] = [
  { id: "w1", name: "Ravi Kumar", role: "Delivery Rider", city: "Bengaluru", phone: "+91 98450 10101", payoutEmail: "bolpay-worker-1@personal.example.com", dailyWage: 590, joinedOn: "2025-02-02", status: "active" },
  { id: "w2", name: "Anita Sharma", role: "Delivery Rider", city: "Bengaluru", phone: "+91 98450 10102", payoutEmail: "bolpay-worker-2@personal.example.com", dailyWage: 620, joinedOn: "2025-03-03", status: "active" },
  { id: "w3", name: "Mohammed Ali", role: "Delivery Rider", city: "Bengaluru", phone: "+91 98450 10103", payoutEmail: "bolpay-worker-3@personal.example.com", dailyWage: 660, joinedOn: "2025-04-04", status: "active" },
  { id: "w4", name: "Priya Nair", role: "Delivery Rider", city: "Bengaluru", phone: "+91 98450 10104", payoutEmail: "bolpay-worker-4@personal.example.com", dailyWage: 700, joinedOn: "2025-05-05", status: "active" },
  { id: "w5", name: "Arjun Reddy", role: "Delivery Rider", city: "Bengaluru", phone: "+91 98450 10105", payoutEmail: "bolpay-worker-5@personal.example.com", dailyWage: 740, joinedOn: "2025-06-06", status: "active" },
  { id: "w6", name: "Sneha Gowda", role: "Delivery Rider", city: "Bengaluru", phone: "+91 98450 10106", payoutEmail: "bolpay-worker-6@personal.example.com", dailyWage: 770, joinedOn: "2025-07-07", status: "active" },
  { id: "w7", name: "Imran Khan", role: "Delivery Rider", city: "Bengaluru", phone: "+91 98450 10107", payoutEmail: "bolpay-worker-7@personal.example.com", dailyWage: 560, joinedOn: "2025-08-08", status: "active" },
  { id: "w8", name: "Lakshmi Iyer", role: "Delivery Rider", city: "Bengaluru", phone: "+91 98450 10108", payoutEmail: "bolpay-worker-8@personal.example.com", dailyWage: 600, joinedOn: "2025-09-09", status: "active" },
  { id: "w9", name: "Karthik Murthy", role: "Delivery Rider", city: "Bengaluru", phone: "+91 98450 10109", payoutEmail: "bolpay-worker-9@personal.example.com", dailyWage: 630, joinedOn: "2025-10-10", status: "active" },
  { id: "w10", name: "Deepa Rao", role: "Delivery Rider", city: "Bengaluru", phone: "+91 98450 10110", payoutEmail: "bolpay-worker-10@personal.example.com", dailyWage: 670, joinedOn: "2025-11-11", status: "active" },
  { id: "w11", name: "Suresh Babu", role: "Delivery Rider", city: "Bengaluru", phone: "+91 98450 10111", payoutEmail: "bolpay-worker-11@personal.example.com", dailyWage: 710, joinedOn: "2025-12-12", status: "active" },
  { id: "w12", name: "Fatima Begum", role: "Delivery Rider", city: "Bengaluru", phone: "+91 98450 10112", payoutEmail: "bolpay-worker-12@personal.example.com", dailyWage: 740, joinedOn: "2025-01-13", status: "active" },
  { id: "w13", name: "Manoj Shetty", role: "Delivery Rider", city: "Bengaluru", phone: "+91 98450 10113", payoutEmail: "bolpay-worker-13@personal.example.com", dailyWage: 780, joinedOn: "2025-02-14", status: "active" },
  { id: "w14", name: "Divya Hegde", role: "Delivery Rider", city: "Bengaluru", phone: "+91 98450 10114", payoutEmail: "bolpay-worker-14@personal.example.com", dailyWage: 570, joinedOn: "2025-03-15", status: "active" },
  { id: "w15", name: "Rahul Verma", role: "Delivery Rider", city: "Bengaluru", phone: "+91 98450 10115", payoutEmail: "bolpay-worker-15@personal.example.com", dailyWage: 600, joinedOn: "2025-04-16", status: "active" },
  { id: "w16", name: "Nandini Patil", role: "Delivery Rider", city: "Bengaluru", phone: "+91 98450 10116", payoutEmail: "bolpay-worker-16@personal.example.com", dailyWage: 640, joinedOn: "2025-05-17", status: "active" },
  { id: "w17", name: "Vikram Singh", role: "Delivery Rider", city: "Bengaluru", phone: "+91 98450 10117", payoutEmail: "bolpay-worker-17@personal.example.com", dailyWage: 680, joinedOn: "2025-06-18", status: "active" },
  { id: "w18", name: "Meena Kumari", role: "Delivery Rider", city: "Bengaluru", phone: "+91 98450 10118", payoutEmail: "bolpay-worker-18@personal.example.com", dailyWage: 720, joinedOn: "2025-07-19", status: "active" },
  { id: "w19", name: "Ganesh Naik", role: "Delivery Rider", city: "Bengaluru", phone: "+91 98450 10119", payoutEmail: "bolpay-worker-19@personal.example.com", dailyWage: 750, joinedOn: "2025-08-20", status: "active" },
  { id: "w20", name: "Pooja Bhat", role: "Delivery Rider", city: "Bengaluru", phone: "+91 98450 10120", payoutEmail: "bolpay-worker-20@personal.example.com", dailyWage: 790, joinedOn: "2025-09-21", status: "active" },
  { id: "w21", name: "Syed Ahmed", role: "Delivery Rider", city: "Bengaluru", phone: "+91 98450 10121", payoutEmail: "bolpay-worker-21@personal.example.com", dailyWage: 580, joinedOn: "2025-10-22", status: "active" },
  { id: "w22", name: "Kavya Menon", role: "Delivery Rider", city: "Bengaluru", phone: "+91 98450 10122", payoutEmail: "bolpay-worker-22@personal.example.com", dailyWage: 610, joinedOn: "2025-11-23", status: "active" },
  { id: "w23", name: "Harish Gowda", role: "Delivery Rider", city: "Bengaluru", phone: "+91 98450 10123", payoutEmail: "bolpay-worker-23@personal.example.com", dailyWage: 650, joinedOn: "2025-12-24", status: "active" },
  { id: "w24", name: "Tanvir Alam", role: "Delivery Rider", city: "Bengaluru", phone: "+91 98450 10124", payoutEmail: "bolpay-worker-24@personal.example.com", dailyWage: 690, joinedOn: "2025-01-25", status: "inactive" },
  { id: "w25", name: "Carlos D'Souza", role: "Delivery Rider", city: "Bengaluru", phone: "+91 98450 10125", payoutEmail: "", dailyWage: 720, joinedOn: "2025-02-26", status: "active" },
];

/** Small deterministic PRNG so mock data is stable between renders. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * Deliberate data problems so the "Needs Review" flow has something to catch:
 *  - w7 and w13 have no attendance record on some recent days (missing records)
 *  - w18 is marked absent on 2026-11-01 but has deliveries logged (conflicting records)
 */
const MISSING = new Set(["w7|2026-11-02", "w13|2026-10-30", "w13|2026-11-02"]);

function generateAttendance(period: Period, workers: Worker[], through: string): AttendanceRecord[] {
  const out: AttendanceRecord[] = [];
  workers
    .filter((w) => w.status === "active")
    .forEach((w, wi) => {
      const rand = rng(wi * 97 + period.start.length + Number(period.start.slice(-2)));
      for (const date of dateRange(period.start, period.end)) {
        if (date > through) break;
        const r = rand();
        const status = r < 0.86 ? "present" : r < 0.92 ? "half" : r < 0.97 ? "absent" : "leave";
        const worked = status === "present" || status === "half";
        const record: AttendanceRecord = {
          workerId: w.id,
          date,
          status,
          overtimeHours: worked && rand() < 0.2 ? Math.ceil(rand() * 2) : 0,
          units: worked ? Math.round(6 + rand() * 30) : 0,
        };
        if (MISSING.has(`${w.id}|${date}`)) continue;
        if (w.id === "w18" && date === "2026-11-01") Object.assign(record, { status: "absent", units: 14 });
        out.push(record);
      }
    });
  return out;
}

export const SEED_ATTENDANCE: AttendanceRecord[] = [
  ...generateAttendance(PREVIOUS_PERIOD, SEED_WORKERS, PREVIOUS_PERIOD.end),
  ...generateAttendance(CURRENT_PERIOD, SEED_WORKERS, TODAY),
];

/** Display currency is INR; PayPal sandbox settles in USD at this rate (override with INR_PER_USD). */
export const DEFAULT_INR_PER_USD = 85;

// Last period was already paid out, so the transactions page has history.
const prevRecords = SEED_ATTENDANCE.filter((r) => r.date <= PREVIOUS_PERIOD.end);

export const SEED_PAYOUTS: Payout[] = SEED_WORKERS.filter((w) => w.status === "active").map((w, i) => {
  const breakdown = calculatePay(w, prevRecords, DEFAULT_RULES);
  return {
    id: `po-prev-${w.id}`,
    workerId: w.id,
    periodId: PREVIOUS_PERIOD.id,
    periodLabel: PREVIOUS_PERIOD.label,
    breakdown,
    amount: breakdown.total,
    status: "approved" as const,
    ruleVersion: DEFAULT_RULES.version,
    rulesSnapshot: DEFAULT_RULES,
    submittedAt: `2026-10-21T0${8 + (i % 2)}:15:00.000Z`,
    decidedAt: "2026-10-21T10:30:00.000Z",
  };
});

export const SEED_TRANSACTIONS: Transaction[] = SEED_PAYOUTS.map((p, i) => {
  const failed = p.workerId === "w25";
  return {
    id: `tx-prev-${p.workerId}`,
    payoutId: p.id,
    workerId: p.workerId,
    periodLabel: p.periodLabel,
    amount: p.amount,
    usdAmount: Math.round((p.amount / DEFAULT_INR_PER_USD) * 100) / 100,
    fxRate: DEFAULT_INR_PER_USD,
    status: failed ? ("failed" as const) : ("completed" as const),
    createdAt: `2026-10-21T10:${String(30 + (i % 30)).padStart(2, "0")}:00.000Z`,
    reference: failed ? "—" : `PP-${4821 + i * 37}`,
    failureReason: failed ? "Worker has no PayPal account on file" : undefined,
  };
});
