import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_RULES } from "@/app/lib/merchant/incentives";
import { SEED_ATTENDANCE, SEED_PAYOUTS, SEED_TRANSACTIONS, SEED_WORKERS } from "@/app/lib/merchant/mock-data";
import type { AttendanceRecord, IncentiveRules, Payout, Transaction, Worker } from "@/app/lib/merchant/types";

/**
 * File-backed JSON database (.data/db.json), seeded from the mock data on first use.
 * It stands in for Postgres + Prisma: everything goes through ./service.ts, so swapping
 * the storage later only touches this file. Single-process only (no locking), and the
 * file needs a writable disk, so it won't work on serverless hosts.
 */
/** Bump when the data shape changes; an older .data/db.json is discarded and reseeded. */
export const SCHEMA_VERSION = 2;

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

const FILE = path.join(process.cwd(), ".data", "db.json");
const g = globalThis as unknown as { __db?: Db };

function seed(): Db {
  return structuredClone({
    schemaVersion: SCHEMA_VERSION,
    audit: [],
    batchSalt: Math.random().toString(36).slice(2, 10),
    workers: SEED_WORKERS,
    attendance: SEED_ATTENDANCE,
    rules: DEFAULT_RULES,
    payouts: SEED_PAYOUTS,
    transactions: SEED_TRANSACTIONS,
  });
}

export function getDb(): Db {
  if (g.__db && g.__db.schemaVersion === SCHEMA_VERSION) return g.__db;
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, "utf8")) as Db;
    if (parsed.schemaVersion !== SCHEMA_VERSION) throw new Error("outdated schema");
    g.__db = parsed;
  } catch {
    g.__db = seed();
    saveDb();
  }
  return g.__db!;
}

/** Appends to the audit log (calculations, approvals, rule changes, imports). Capped to stay small. */
export function logAudit(action: string, detail: string) {
  const db = getDb();
  db.audit.push({ at: new Date().toISOString(), action, detail });
  if (db.audit.length > 500) db.audit.splice(0, db.audit.length - 500);
}

/** Atomic write (temp file + rename) so a crash can't leave a half-written database. */
export function saveDb() {
  if (!g.__db) return;
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const tmp = `${FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(g.__db));
    fs.renameSync(tmp, FILE);
  } catch (err) {
    console.error("Could not persist database; continuing in memory", err);
  }
}

/** Dev helper: drop all data and re-seed. */
export function resetDb() {
  g.__db = seed();
  saveDb();
}
