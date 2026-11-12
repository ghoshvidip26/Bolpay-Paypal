#!/usr/bin/env node
/**
 * Offline checks for the Zoho mapper (no network, no Zoho account needed).
 *
 *   node scripts/zoho-mapper-check.mjs                 # responses shaped like Zoho's documented API samples
 *   node scripts/zoho-mapper-check.mjs rows.json       # also map rows exported from the Zoho People UI
 *
 * rows.json is an array of objects keyed by the export's column labels ("Employee ID", "First Name", ...).
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { flattenEmployeeRecords, mapAttendanceDay, mapAttendanceReport, mapEmployee, parseDate } from "../app/lib/zoho/mapper.ts";

const opts = { today: "2026-11-12", defaultCity: "Unknown" };
let checks = 0;
const ok = (name, fn) => {
  fn();
  checks++;
  console.log("  ok  ", name);
};

ok("dates: iso, dd-MMM-yyyy, dd/MM/yyyy, Date", () => {
  assert.equal(parseDate("2020-03-16"), "2020-03-16");
  assert.equal(parseDate("08-Nov-2026"), "2026-11-08");
  assert.equal(parseDate("03/01/2004"), "2004-01-03");
  assert.equal(parseDate(new Date(2004, 0, 3)), "2004-01-03");
  assert.equal(parseDate(""), null);
});

ok("employee record wrapper from getRecords is flattened and mapped (API field names)", () => {
  const result = [{ "406336000000315584": [{ EmployeeID: "S19", FirstName: "Michael", LastName: "Johnson", EmailID: "michaeljohnson@zylker.com", Employeestatus: "Active", Zoho_ID: 406336000000315584, tabularSections: {} }] }];
  const rows = flattenEmployeeRecords(result);
  assert.equal(rows.length, 1);
  const e = mapEmployee(rows[0], opts);
  assert.equal(e.externalId, "zoho:S19");
  assert.equal(e.name, "Michael Johnson");
  assert.equal(e.email, "michaeljohnson@zylker.com");
  assert.equal(e.active, true);
});

ok("inactive when the status is not Active or the exit date has passed", () => {
  assert.equal(mapEmployee({ EmployeeID: "X1", FirstName: "A", Employeestatus: "Terminated" }, opts).active, false);
  assert.equal(mapEmployee({ EmployeeID: "X2", FirstName: "B", Employeestatus: "Active", Dateofexit: "01-Nov-2026" }, opts).active, false);
  assert.equal(mapEmployee({ EmployeeID: "X3", FirstName: "C", Employeestatus: "Active", Dateofexit: "30-Nov-2026" }, opts).active, true);
});

ok("custom wage and payout email fields are read when configured", () => {
  const e = mapEmployee({ EmployeeID: "X4", FirstName: "D", Daily_Wage: "₹1,250", PayPal_Email: "d@example.com" }, { ...opts, wageField: "Daily_Wage", payoutEmailField: "PayPal_Email" });
  assert.equal(e.wage, 1250);
  assert.equal(e.payoutEmail, "d@example.com");
});

ok("attendance: absent, weekend skipped, unmarked skipped, leave type, present by punches, half by hours", () => {
  assert.deepEqual(mapAttendanceDay({ Status: "Absent", TotalHours: "00:00", WorkingHours: "00:00", FirstIn: "-" }), { status: "absent", overtimeHours: 0 });
  assert.equal(mapAttendanceDay({ Status: "Weekend", WorkingHours: "08:00" }), null);
  assert.equal(mapAttendanceDay({ Status: "", TotalHours: "00:00", FirstIn: "" }), null);
  assert.deepEqual(mapAttendanceDay({ Status: "Sick", TotalHours: "00:00", WorkingHours: "08:00", FirstIn: "16-Mar-2020 09:20 AM" }).status, "present");
  assert.equal(mapAttendanceDay({ Status: "Sick", TotalHours: "00:00", WorkingHours: "00:00", FirstIn: "-" }).status, "leave");
  assert.equal(mapAttendanceDay({ Status: "Present", TotalHours: "03:00", FirstIn: "x" }).status, "half");
  assert.deepEqual(mapAttendanceDay({ Status: "Present", TotalHours: "09:30", OverTime: "01:30", FirstIn: "x" }), { status: "present", overtimeHours: 1.5 });
});

ok("multi-employee attendance report (documented shape) maps to dated records per employee", () => {
  const result = [
    { employeeDetails: { "mail id": "kumar.k@abc.om", erecno: "1", "last name": "Kumar", "first name": "Selva", id: "1" }, attendanceDetails: { "2020-03-21": { Status: "Absent", TotalHours: "00:00", WorkingHours: "00:00", FirstIn: "-" }, "2020-03-22": { Status: "Weekend" } } },
  ];
  const rec = mapAttendanceReport(result);
  assert.equal(rec.length, 1);
  assert.deepEqual({ ...rec[0] }, { employeeId: "1", email: "kumar.k@abc.om", date: "2020-03-21", status: "absent", overtimeHours: 0 });
});

if (process.argv[2]) {
  const rows = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const mapped = rows.map((r) => mapEmployee(r, opts)).filter(Boolean);
  ok(`export rows: all ${rows.length} rows map to an employee with an id and a name`, () => {
    assert.equal(mapped.length, rows.length);
    for (const m of mapped) assert.ok(m.employeeId && m.name);
  });
  console.log("\nSample of mapped export rows:");
  for (const m of mapped.slice(0, 6)) console.log(`  ${m.externalId.padEnd(10)} ${m.name.padEnd(20)} ${m.role.padEnd(18)} dept=${m.department.padEnd(10)} city=${m.city.padEnd(12)} joined=${m.joinedOn} active=${m.active} email=${m.email}`);
  console.log(`  ... ${mapped.filter((m) => m.active).length} active, ${mapped.filter((m) => !m.active).length} inactive`);
}
console.log(`\n${checks} checks passed`);
