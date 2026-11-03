import type { AttendanceRecord, IncentiveRules, PayBreakdown, Worker } from "./types";

export const DEFAULT_RULES: IncentiveRules = {
  workingHoursPerDay: 8,
  overtimeMultiplier: 1.5,
  dailyUnitTarget: 20,
  ratePerExtraUnit: 0.75,
  attendanceThreshold: 0.9,
  attendanceBonus: 25,
};

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

  for (const r of mine) {
    if (r.status === "present") payDays += 1;
    else if (r.status === "half") payDays += 0.5;
    if (r.status === "present" || r.status === "half") {
      overtimeHours += r.overtimeHours;
      extraUnits += Math.max(0, r.units - rules.dailyUnitTarget);
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
    attendanceBonus,
    total: round2(basePay + overtimePay + performanceIncentive + attendanceBonus),
  };
}
