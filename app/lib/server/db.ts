import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_RULES } from "@/app/lib/merchant/incentives";
import { SEED_ATTENDANCE, SEED_PAYOUTS, SEED_TRANSACTIONS, SEED_WORKERS } from "@/app/lib/merchant/mock-data";
import type { AttendanceRecord, IncentiveRules, Payout, Transaction, Worker } from "@/app/lib/merchant/types";

/**
 * File-backed JSON databases under .data/, one per workspace:
 *  - "demo": .data/db.json, seeded from the mock data (the trained demo dataset)
 *  - "zoho": .data/zoho.json, starts empty and is filled by syncing from Zoho People
 * Everything reads and writes through getDb(), so the whole app (screens, payouts, voice) works
 * on whichever workspace is active without knowing about the other one.
 * It stands in for Postgres + Prisma: everything goes through ./service.ts, so swapping
 * the storage later only touches this file. Single-process only (no locking), and the
 * file needs a writable disk, so it won't work on serverless hosts.
 */
/** Bump when the data shape changes; an older database file is discarded and reseeded. */
export const SCHEMA_VERSION = 2;

export type Workspace = "demo" | "zoho";
export const WORKSPACES: Workspace[] = ["demo", "zoho"];

export interface AuditEntry {
  at: string;
  action: string;
  detail: string;
}

export interface Db {
  schemaVersion: number;
  audit: AuditEntry[];
  /** Random per database, so a reseed never reuses PayPal sender_batch_ids from earlier runs. */
  batchSalt?: string;
  workers: Worker[];
  attendance: AttendanceRecord[];
  rules: IncentiveRules;
  payouts: Payout[];
  transactions: Transaction[];
}

const DIR = path.join(process.cwd(), ".data");
const FILES: Record<Workspace, string> = { demo: path.join(DIR, "db.json"), zoho: path.join(DIR, "zoho.json") };
const ACTIVE_FILE = path.join(DIR, "workspace.json");
// globalThis (not module state) so every route bundle sees the same cache and the same active workspace.
const g = globalThis as unknown as { __dbs?: Partial<Record<Workspace, Db>>; __workspace?: Workspace };

/** The workspace the app is currently showing. Defaults to the demo data. */
export function getWorkspace(): Workspace {
  if (g.__workspace) return g.__workspace;
  let ws: Workspace = "demo";
  try {
    const saved = (JSON.parse(fs.readFileSync(ACTIVE_FILE, "utf8")) as { active?: string }).active;
    if (saved === "zoho") ws = "zoho";
  } catch {
    /* no saved choice yet */
  }
  g.__workspace = ws;
  return ws;
}

export function setWorkspace(ws: Workspace) {
  g.__workspace = ws;
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(ACTIVE_FILE, JSON.stringify({ active: ws }));
  } catch (err) {
    console.error("Could not persist the active workspace; continuing in memory", err);
  }
}

function seed(ws: Workspace): Db {
  const base = { schemaVersion: SCHEMA_VERSION, audit: [], batchSalt: Math.random().toString(36).slice(2, 10), rules: DEFAULT_RULES };
  if (ws === "zoho") return structuredClone({ ...base, workers: [], attendance: [], payouts: [], transactions: [] });
  return structuredClone({ ...base, workers: SEED_WORKERS, attendance: SEED_ATTENDANCE, payouts: SEED_PAYOUTS, transactions: SEED_TRANSACTIONS });
}

export function getDb(ws: Workspace = getWorkspace()): Db {
  const cache = (g.__dbs ??= {});
  const hit = cache[ws];
  if (hit && hit.schemaVersion === SCHEMA_VERSION) return hit;
  try {
    const parsed = JSON.parse(fs.readFileSync(FILES[ws], "utf8")) as Db;
    if (parsed.schemaVersion !== SCHEMA_VERSION) throw new Error("outdated schema");
    cache[ws] = parsed;
  } catch {
    cache[ws] = seed(ws);
    saveDb(ws);
  }
  return cache[ws]!;
}

/** Appends to the audit log (calculations, approvals, rule changes, imports). Capped to stay small. */
export function logAudit(action: string, detail: string, ws: Workspace = getWorkspace()) {
  const db = getDb(ws);
  db.audit.push({ at: new Date().toISOString(), action, detail });
  if (db.audit.length > 500) db.audit.splice(0, db.audit.length - 500);
}

/** Atomic write (temp file + rename) so a crash can't leave a half-written database. */
export function saveDb(ws: Workspace = getWorkspace()) {
  const db = g.__dbs?.[ws];
  if (!db) return;
  try {
    const file = FILES[ws];
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, file);
  } catch (err) {
    console.error("Could not persist database; continuing in memory", err);
  }
}

/** Dev helper: drop all data in a workspace and re-seed it. */
export function resetDb(ws: Workspace = getWorkspace()) {
  (g.__dbs ??= {})[ws] = seed(ws);
  saveDb(ws);
}
