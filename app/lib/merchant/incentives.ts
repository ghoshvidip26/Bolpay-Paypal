import type { AttendanceRecord, IncentiveRules, PayBreakdown, Worker } from "./types";

export const DEFAULT_RULES: IncentiveRules = {
  workingHoursPerDay: 8,
  overtimeMultiplier: 1.5,
  dailyUnitTarget: 30,
  ratePerExtraUnit: 5,
  attendanceThreshold: 0.9,
  attendanceBonus: 250,
  // 10 / 20 / 30 deliveries in a day -> ₹50 / ₹100 / ₹150
  deliveryTiers: [
    { minUnits: 10, bonus: 50 },
    { minUnits: 20, bonus: 100 },
    { minUnits: 30, bonus: 150 },
  ],
  version: 1,
};

/** Bonus for one day's deliveries: the highest tier reached (tiers don't stack). */
export function tierBonusFor(units: number, tiers: IncentiveRules["deliveryTiers"] = []): number {
  let bonus = 0;
  let best = -1;
  for (const t of tiers) if (units >= t.minUnits && t.minUnits > best) { best = t.minUnits; bonus = t.bonus; }
  return bonus;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Pure calculation of a worker's pay for a set of attendance records.
 * `periodDays` is the number of days in the period that have been marked,
 * so attendance rate isn't penalised for days not yet recorded.
 */
export function calculatePay(
  worker: Worker,
  records: AttendanceRecord[],
  rules: IncentiveRules,
): PayBreakdown {
  const mine = records.filter((r) => r.workerId === worker.id);
  const periodDays = mine.length;

  let payDays = 0;
  let overtimeHours = 0;
  let extraUnits = 0;
  let tierBonus = 0;

  for (const r of mine) {
    if (r.status === "present") payDays += 1;
    else if (r.status === "half") payDays += 0.5;
    if (r.status === "present" || r.status === "half") {
      overtimeHours += r.overtimeHours;
      extraUnits += Math.max(0, r.units - rules.dailyUnitTarget);
      tierBonus += tierBonusFor(r.units, rules.deliveryTiers);
    }
  }

  const attendanceRate = periodDays === 0 ? 0 : payDays / periodDays;
  const hourly = worker.dailyWage / rules.workingHoursPerDay;

  const basePay = round2(payDays * worker.dailyWage);
  const overtimePay = round2(overtimeHours * hourly * rules.overtimeMultiplier);
  const performanceIncentive = round2(extraUnits * rules.ratePerExtraUnit);
  const attendanceBonus =
    periodDays > 0 && attendanceRate >= rules.attendanceThreshold ? rules.attendanceBonus : 0;

  return {
    workerId: worker.id,
    periodDays,
    payDays,
    overtimeHours,
    extraUnits,
    attendanceRate,
    basePay,
    overtimePay,
    performanceIncentive,
    tierBonus: round2(tierBonus),
    attendanceBonus,
    total: round2(basePay + overtimePay + performanceIncentive + tierBonus + attendanceBonus),
  };
}
