/**
 * Pure mapping from Zoho People data to BolPay records. No imports from the rest of the app, so it can be
 * run and tested on its own (see scripts/zoho-mapper-check.mjs).
 *
 * It accepts two shapes of the same data:
 *  - the API ("forms/employee/getRecords"), whose keys are field link names like EmployeeID, FirstName
 *  - the report exports from the Zoho People UI, whose keys are labels like "Employee ID", "First Name"
 * Keys are compared after lower-casing and removing everything that is not a letter or digit.
 */

export interface MappedEmployee {
  externalId: string;
  employeeId: string;
  name: string;
  email: string;
  role: string;
  department: string;
  city: string;
  phone: string;
  joinedOn: string | null;
  active: boolean;
  /** Optional wage read from a custom field (see ZOHO_WAGE_FIELD). */
  wage: number | null;
  /** Optional PayPal email read from a custom field (see ZOHO_PAYOUT_EMAIL_FIELD). */
  payoutEmail: string | null;
}

export interface MappedAttendance {
  employeeId: string;
  email: string;
  date: string;
  status: "present" | "half" | "absent" | "leave";
  overtimeHours: number;
}

export const keyOf = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");

type Row = Record<string, unknown>;

const text = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && !(v instanceof Date)) {
    const o = v as Record<string, unknown>;
    return text(o.display_value ?? o.displayValue ?? o.value ?? o.name ?? "");
  }
  return String(v).trim();
};

/** First non-empty value among the candidate field names. */
export function pick(row: Row, aliases: string[]): string {
  const wanted = aliases.map(keyOf);
  const byKey = new Map(Object.entries(row).map(([k, v]) => [keyOf(k), v]));
  for (const a of wanted) {
    const t = text(byKey.get(a));
    if (t) return t;
  }
  return "";
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Understands Date objects, yyyy-MM-dd, dd-MMM-yyyy (Zoho's default) and dd/MM/yyyy. Returns yyyy-MM-dd or null. */
export function parseDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  const s = text(v);
  if (!s) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[-\s/]([A-Za-z]{3})[a-z]*[-\s/](\d{4})/.exec(s);
  if (m) {
    const mi = MONTHS.indexOf(m[2].toLowerCase());
    if (mi >= 0) return `${m[3]}-${pad(mi + 1)}-${pad(Number(m[1]))}`;
  }
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) return `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  return null;
}

/** "HH:MM" or a decimal number of hours to hours. */
export function hoursOf(v: unknown): number {
  const s = text(v);
  if (!s || s === "-") return 0;
  const m = /^(\d+):(\d{2})$/.exec(s);
  if (m) return Number(m[1]) + Number(m[2]) / 60;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Zoho addresses look like "360 NW,98th St,Miami,Florida,UNITED STATES,33150": the city is the third part. */
export function cityFromAddress(address: string): string {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length >= 3 ? parts[2] : "";
}

export interface MapOptions {
  /** Link name or label of a custom field holding the daily wage. */
  wageField?: string;
  /** Link name or label of a custom field holding the PayPal email. */
  payoutEmailField?: string;
  /** City to use when the address has none. */
  defaultCity?: string;
  /** Today as yyyy-MM-dd, used for the exit-date check. */
  today: string;
}

/** "Team Member" alone says little, so it is prefixed with the department ("IT Team Member"). */
function roleOf(designation: string, department: string): string {
  if (!designation) return department || "Employee";
  return designation.toLowerCase() === "team member" && department ? `${department} ${designation}` : designation;
}

export function mapEmployee(row: Row, o: MapOptions): MappedEmployee | null {
  const employeeId = pick(row, ["EmployeeID", "Employee ID", "EmpID"]);
  if (!employeeId) return null;
  const first = pick(row, ["FirstName", "First Name"]);
  const last = pick(row, ["LastName", "Last Name"]);
  const name = `${first} ${last}`.trim() || pick(row, ["Nick name", "Nickname"]) || employeeId;
  const status = pick(row, ["Employeestatus", "Employee Status", "Status"]).toLowerCase();
  const exit = parseDate(pick(row, ["Dateofexit", "Date of Exit"]));
  const wageRaw = o.wageField ? Number(pick(row, [o.wageField]).replace(/[^\d.]/g, "")) : NaN;
  return {
    externalId: `zoho:${employeeId}`,
    employeeId,
    name,
    email: pick(row, ["EmailID", "Email address", "Email", "Email ID"]),
    role: roleOf(pick(row, ["Designation"]), pick(row, ["Department"])),
    department: pick(row, ["Department"]),
    city: cityFromAddress(pick(row, ["PresentAddress", "Present Address", "Address"])) || o.defaultCity || "Unknown",
    phone: pick(row, ["Work Phone Number", "WorkPhoneNumber", "Mobile", "Personal Mobile Number"]),
    joinedOn: parseDate(pick(row, ["Dateofjoining", "Date of Joining", "DOJ"])),
    active: (status === "" || status === "active") && !(exit && exit <= o.today),
    wage: Number.isFinite(wageRaw) && wageRaw > 0 ? wageRaw : null,
    payoutEmail: o.payoutEmailField ? pick(row, [o.payoutEmailField]) || null : null,
  };
}

/** The API wraps each record as { "<zohoId>": [ { ...fields } ] }. Returns the flat field objects. */
export function flattenEmployeeRecords(result: unknown): Row[] {
  if (!Array.isArray(result)) return [];
  const rows: Row[] = [];
  for (const item of result) {
    if (!item || typeof item !== "object") continue;
    for (const v of Object.values(item as Record<string, unknown>)) {
      if (Array.isArray(v) && v[0] && typeof v[0] === "object") rows.push(v[0] as Row);
      else if (v && typeof v === "object" && !Array.isArray(v)) rows.push(v as Row);
    }
  }
  return rows;
}

/**
 * One day of Zoho attendance to a BolPay status, or null when the day carries no information
 * (weekend, holiday, future or unmarked). Hours decide present versus half day.
 */
export function mapAttendanceDay(day: Row): { status: MappedAttendance["status"]; overtimeHours: number } | null {
  const status = text(day.Status).toLowerCase();
  const worked = Math.max(hoursOf(day.TotalHours), hoursOf(day.WorkingHours));
  const overtime = Math.round(hoursOf(day.OverTime) * 100) / 100;
  if (status.includes("weekend") || status.includes("holiday") || status.includes("week off")) return null;
  if (status.includes("absent")) return { status: "absent", overtimeHours: 0 };
  if (status.includes("half")) return { status: "half", overtimeHours: overtime };
  const punched = text(day.FirstIn) !== "" && text(day.FirstIn) !== "-";
  if (status.includes("present") || punched || (worked > 0 && status === "")) {
    return { status: worked > 0 && worked < 4 ? "half" : "present", overtimeHours: overtime };
  }
  if (status !== "") return { status: "leave", overtimeHours: 0 };
  return null;
}

/** Flattens the multi-employee attendance response: result[].{employeeDetails, attendanceDetails}. */
export function mapAttendanceReport(result: unknown): MappedAttendance[] {
  const out: MappedAttendance[] = [];
  if (!Array.isArray(result)) return out;
  for (const r of result) {
    const rec = (r ?? {}) as { employeeDetails?: Row; attendanceDetails?: Record<string, Row> };
    const who = rec.employeeDetails ?? {};
    const employeeId = pick(who, ["id", "Employee ID", "EmployeeID"]);
    const email = pick(who, ["mail id", "Email ID", "EmailID"]);
    for (const [rawDate, day] of Object.entries(rec.attendanceDetails ?? {})) {
      const date = parseDate(rawDate);
      const mapped = date ? mapAttendanceDay(day) : null;
      if (date && mapped) out.push({ employeeId, email, date, ...mapped });
    }
  }
  return out;
}
