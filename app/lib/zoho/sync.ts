import "server-only";
import type { Worker } from "@/app/lib/merchant/types";
import { getPeriod, getToday } from "@/app/lib/server/context";
import { getDb, logAudit, saveDb } from "@/app/lib/server/db";
import { fetchAttendance, fetchEmployeeRows, writeZoho, zohoConfig, ZohoError, type SyncSummary } from "./client";
import { mapEmployee, type MappedEmployee } from "./mapper";

const WS = "zoho" as const;
const idFor = (employeeId: string) => `z-${employeeId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

/**
 * Pulls employees and this period's attendance from Zoho People into the Zoho workspace.
 *
 * Who owns what, so a re-sync never undoes work done in BolPay:
 *  - Zoho owns identity and attendance: name, role, department, city, phone, joining date, active status,
 *    and the attendance of every day Zoho reports (weekends, holidays and unmarked days are left alone).
 *  - BolPay owns pay: daily wage and PayPal email are set once when an employee is first imported
 *    (from the optional custom fields, else from the defaults) and are never overwritten by a sync.
 * Zoho People has no salary data, so the default wage (ZOHO_DEFAULT_DAILY_WAGE) is a placeholder to edit.
 */
export async function syncZoho(): Promise<SyncSummary> {
  const cfg = zohoConfig();
  const today = getToday(WS);
  const period = getPeriod(WS);
  const warnings: string[] = [];

  const rows = await fetchEmployeeRows();
  const employees = rows
    .map((r) => mapEmployee(r, { today, defaultCity: cfg.defaultCity, wageField: cfg.wageField, payoutEmailField: cfg.payoutEmailField }))
    .filter((e): e is MappedEmployee => e !== null);
  if (employees.length === 0) throw new ZohoError("Zoho returned no employee records. Check that the connected user can view the Employee form.", 502);

  const db = getDb(WS);
  let created = 0;
  let updated = 0;
  for (const e of employees) {
    const existing = db.workers.find((w) => w.externalId === e.externalId);
    const common = { name: e.name, role: e.role, city: e.city, phone: e.phone, status: e.active ? ("active" as const) : ("inactive" as const), department: e.department, joinedOn: e.joinedOn ?? today };
    if (existing) {
      Object.assign(existing, common);
      // BolPay owns the PayPal email, except that an empty one is filled once Zoho has an address for the employee.
      if (!existing.payoutEmail) existing.payoutEmail = e.payoutEmail ?? e.email;
      updated++;
    } else {
      const w: Worker = { id: idFor(e.employeeId), payoutEmail: e.payoutEmail ?? e.email, dailyWage: e.wage ?? cfg.defaultWage, externalId: e.externalId, source: "zoho", ...common };
      db.workers.push(w);
      created++;
    }
  }

  let attendance: SyncSummary["attendance"] = null;
  const to = today < period.end ? today : period.end;
  try {
    const byId = new Map(db.workers.map((w) => [w.externalId, w]));
    const byEmail = new Map(employees.filter((e) => e.email).map((e) => [e.email.toLowerCase(), e.externalId]));
    const records = await fetchAttendance(period.start, to);
    const covered = new Set<string>();
    let written = 0;
    for (const r of records) {
      const worker = byId.get(`zoho:${r.employeeId}`) ?? byId.get(byEmail.get(r.email.toLowerCase()) ?? "");
      if (!worker || r.date < period.start || r.date > to) continue;
      db.attendance = db.attendance.filter((a) => !(a.workerId === worker.id && a.date === r.date));
      db.attendance.push({ workerId: worker.id, date: r.date, status: r.status, overtimeHours: r.overtimeHours, units: 0 });
      covered.add(worker.id);
      written++;
    }
    attendance = { records: written, employees: covered.size, from: period.start, to };
    if (written === 0) warnings.push("Zoho reported no attendance for this period (no check-ins, absences or leave recorded yet).");
  } catch (err) {
    // Employees are still useful without attendance (HR can mark it in BolPay), so report and carry on.
    warnings.push(`Attendance was not imported: ${err instanceof Error ? err.message : "unknown error"}. Employees were imported.`);
  }

  const summary: SyncSummary = {
    at: new Date().toISOString(),
    employees: { total: employees.length, created, updated, inactive: employees.filter((e) => !e.active).length },
    attendance,
    warnings,
  };
  logAudit("zoho.sync", `${created} created, ${updated} updated, ${attendance?.records ?? 0} attendance records`, WS);
  saveDb(WS);
  writeZoho({ lastSync: summary });
  return summary;
}
