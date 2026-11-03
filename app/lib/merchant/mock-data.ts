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
  { id: "w1", name: "Ravi Kumar", role: "Packer", phone: "+1 555 0101", payoutEmail: "ravi.k@example.com", dailyWage: 48, joinedOn: "2025-03-12", status: "active" },
  { id: "w2", name: "Anita Sharma", role: "Cashier", phone: "+1 555 0102", payoutEmail: "anita.s@example.com", dailyWage: 56, joinedOn: "2024-11-02", status: "active" },
  { id: "w3", name: "Mohammed Ali", role: "Delivery", phone: "+1 555 0103", payoutEmail: "m.ali@example.com", dailyWage: 52, joinedOn: "2025-06-20", status: "active" },
  { id: "w4", name: "Priya Nair", role: "Sales Assistant", phone: "+1 555 0104", payoutEmail: "priya.n@example.com", dailyWage: 54, joinedOn: "2025-01-08", status: "active" },
  { id: "w5", name: "Carlos Mendez", role: "Packer", phone: "+1 555 0105", payoutEmail: "", dailyWage: 46, joinedOn: "2026-08-17", status: "active" },
  { id: "w6", name: "Sunita Devi", role: "Cleaner", phone: "+1 555 0106", payoutEmail: "sunita.d@example.com", dailyWage: 40, joinedOn: "2024-05-30", status: "active" },
  { id: "w7", name: "Tom Becker", role: "Delivery", phone: "+1 555 0107", payoutEmail: "tom.b@example.com", dailyWage: 52, joinedOn: "2023-09-14", status: "inactive" },
];

/** Small deterministic PRNG so mock data is stable between renders. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function generateAttendance(period: Period, workers: Worker[], through: string): AttendanceRecord[] {
  const out: AttendanceRecord[] = [];
  workers
    .filter((w) => w.status === "active")
    .forEach((w, wi) => {
      const rand = rng(wi * 97 + period.start.length + Number(period.start.slice(-2)));
      for (const date of dateRange(period.start, period.end)) {
        if (date > through) break;
        const r = rand();
        const status = r < 0.82 ? "present" : r < 0.9 ? "half" : r < 0.96 ? "absent" : "leave";
        const worked = status === "present" || status === "half";
        out.push({
          workerId: w.id,
          date,
          status,
          overtimeHours: worked && rand() < 0.25 ? Math.ceil(rand() * 3) : 0,
          units: worked ? Math.round(14 + rand() * 14) : 0,
        });
      }
    });
  return out;
}

/** Everything up to (not including) today is already marked. */
export const SEED_ATTENDANCE: AttendanceRecord[] = [
  ...generateAttendance(PREVIOUS_PERIOD, SEED_WORKERS, PREVIOUS_PERIOD.end),
  ...generateAttendance(CURRENT_PERIOD, SEED_WORKERS, "2026-11-02"),
];

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
    submittedAt: `2026-10-21T0${8 + (i % 2)}:15:00.000Z`,
    decidedAt: "2026-10-21T10:30:00.000Z",
  };
});

export const SEED_TRANSACTIONS: Transaction[] = SEED_PAYOUTS.map((p, i) => {
  const failed = p.workerId === "w5";
  return {
    id: `tx-prev-${p.workerId}`,
    payoutId: p.id,
    workerId: p.workerId,
    periodLabel: p.periodLabel,
    amount: p.amount,
    status: failed ? ("failed" as const) : ("completed" as const),
    createdAt: `2026-10-21T10:3${i}:00.000Z`,
    reference: `PP-${4821 + i * 37}`,
    failureReason: failed ? "Worker has no PayPal account on file" : undefined,
  };
});
