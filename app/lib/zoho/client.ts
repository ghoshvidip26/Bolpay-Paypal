import "server-only";
import fs from "node:fs";
import path from "node:path";
import { flattenEmployeeRecords, mapAttendanceReport, type MappedAttendance } from "./mapper";

/**
 * Zoho People access: OAuth 2.0 sign-in ("Connect Zoho") plus the two read calls the sync needs.
 * Endpoints (official docs, India data center uses the .in hosts):
 *   authorize  {ACCOUNTS}/oauth/v2/auth      token  {ACCOUNTS}/oauth/v2/token
 *   employees  GET {PEOPLE}/people/api/forms/employee/getRecords      (200 records per call)
 *   attendance GET {PEOPLE}/people/api/attendance/getUserReport       (100 employees per call)
 * Zoho People has no salary API (payroll is a separate Zoho product), so wages are configured, see sync.ts.
 */
export class ZohoError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

const trimSlash = (s: string) => s.replace(/\/+$/, "");

export function zohoConfig() {
  return {
    clientId: process.env.ZOHO_CLIENT_ID ?? "",
    clientSecret: process.env.ZOHO_CLIENT_SECRET ?? "",
    accountsUrl: trimSlash(process.env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.in"),
    peopleUrl: trimSlash(process.env.ZOHO_PEOPLE_URL || "https://people.zoho.in"),
    redirectUri: process.env.ZOHO_REDIRECT_URI || "http://localhost:3000/api/zoho/callback",
    scopes: process.env.ZOHO_SCOPES || "ZOHOPEOPLE.forms.READ,ZOHOPEOPLE.attendance.READ",
    envRefreshToken: process.env.ZOHO_REFRESH_TOKEN ?? "",
    wageField: process.env.ZOHO_WAGE_FIELD || undefined,
    payoutEmailField: process.env.ZOHO_PAYOUT_EMAIL_FIELD || undefined,
    defaultWage: Number(process.env.ZOHO_DEFAULT_DAILY_WAGE) > 0 ? Number(process.env.ZOHO_DEFAULT_DAILY_WAGE) : 1200,
    defaultCity: process.env.ZOHO_DEFAULT_CITY || "Unknown",
  };
}

export const zohoConfigured = () => {
  const c = zohoConfig();
  return Boolean(c.clientId && c.clientSecret);
};

/* --------------------------- token store (.data/integrations.json) --------------------------- */

export interface SyncSummary {
  at: string;
  employees: { total: number; created: number; updated: number; inactive: number };
  attendance: { records: number; employees: number; from: string; to: string } | null;
  warnings: string[];
}

interface Stored {
  refreshToken?: string;
  accessToken?: string;
  expiresAt?: number;
  connectedAt?: string;
  lastSync?: SyncSummary;
}

const FILE = path.join(process.env.DATA_DIR || path.join(process.cwd(), ".data"), "integrations.json");

function readAll(): { zoho?: Stored } {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as { zoho?: Stored };
  } catch {
    return {};
  }
}

export function readZoho(): Stored {
  return readAll().zoho ?? {};
}

export function writeZoho(patch: Partial<Stored> | null) {
  const all = readAll();
  all.zoho = patch === null ? undefined : { ...(all.zoho ?? {}), ...patch };
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(all));
}

/* --------------------------------------- OAuth --------------------------------------- */

export function authorizeUrl(state: string): string {
  const c = zohoConfig();
  const q = new URLSearchParams({ scope: c.scopes, client_id: c.clientId, response_type: "code", access_type: "offline", prompt: "consent", redirect_uri: c.redirectUri, state });
  return `${c.accountsUrl}/oauth/v2/auth?${q}`;
}

async function tokenRequest(form: Record<string, string>) {
  const c = zohoConfig();
  const res = await fetch(`${c.accountsUrl}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, ...form }),
    cache: "no-store",
  });
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !j.access_token) throw new ZohoError(`Zoho rejected the sign-in${j.error ? `: ${j.error}` : ""}.`, res.status === 400 ? 400 : 502);
  return j;
}

/** Finishes the sign-in: swaps the one-time code for tokens and stores them. */
export async function exchangeCode(code: string) {
  const j = await tokenRequest({ grant_type: "authorization_code", redirect_uri: zohoConfig().redirectUri, code });
  if (!j.refresh_token) throw new ZohoError("Zoho did not return a refresh token. Remove BolPay from Zoho's connected apps and connect again.", 400);
  writeZoho({ refreshToken: j.refresh_token, accessToken: j.access_token, expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000, connectedAt: new Date().toISOString() });
}

export function connection(): "oauth" | "env" | null {
  if (readZoho().refreshToken) return "oauth";
  return zohoConfig().envRefreshToken ? "env" : null;
}

async function accessToken(force = false): Promise<string> {
  const stored = readZoho();
  if (!force && stored.accessToken && (stored.expiresAt ?? 0) > Date.now() + 60_000) return stored.accessToken;
  const refresh = stored.refreshToken || zohoConfig().envRefreshToken;
  if (!refresh) throw new ZohoError("Zoho is not connected. Use Connect Zoho first.", 400);
  const j = await tokenRequest({ grant_type: "refresh_token", refresh_token: refresh });
  writeZoho({ accessToken: j.access_token, expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000 });
  return j.access_token!;
}

/* ------------------------------------------ API ------------------------------------------ */

async function get(pathAndQuery: string, retry = true): Promise<Record<string, unknown>> {
  const token = await accessToken(!retry);
  const res = await fetch(`${zohoConfig().peopleUrl}${pathAndQuery}`, { headers: { Authorization: `Zoho-oauthtoken ${token}` }, cache: "no-store" });
  if (res.status === 401 && retry) return get(pathAndQuery, false);
  const body = await res.text();
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(body) as Record<string, unknown>;
  } catch {
    throw new ZohoError(`Zoho People returned an unexpected answer (HTTP ${res.status}).`);
  }
  const wrapped = (j.response ?? j) as { status?: number; message?: string; errors?: unknown };
  if (!res.ok || (typeof wrapped.status === "number" && wrapped.status !== 0)) {
    const detail = wrapped.message || (wrapped.errors ? JSON.stringify(wrapped.errors).slice(0, 200) : `HTTP ${res.status}`);
    throw new ZohoError(`Zoho People: ${detail}`, res.status === 401 || res.status === 403 ? 403 : 502);
  }
  return j;
}

const resultOf = (j: Record<string, unknown>) => ((j.response as Record<string, unknown> | undefined)?.result ?? j.result) as unknown;

/** Every record of the Employee form, 200 per request. */
export async function fetchEmployeeRows(): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let start = 1; start < 5000; start += 200) {
    const batch = flattenEmployeeRecords(resultOf(await get(`/people/api/forms/employee/getRecords?sIndex=${start}&limit=200`)));
    rows.push(...batch);
    if (batch.length < 200) break;
  }
  return rows;
}

/** Attendance for every employee between two dates (yyyy-MM-dd), 100 employees per request. */
export async function fetchAttendance(from: string, to: string): Promise<MappedAttendance[]> {
  const out: MappedAttendance[] = [];
  for (let start = 0; start < 5000; start += 100) {
    const result = resultOf(await get(`/people/api/attendance/getUserReport?sdate=${from}&edate=${to}&dateFormat=yyyy-MM-dd&startIndex=${start}`));
    out.push(...mapAttendanceReport(result));
    if (!Array.isArray(result) || result.length < 100) break;
  }
  return out;
}
