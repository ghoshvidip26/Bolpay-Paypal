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
export interface Db {
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
    workers: SEED_WORKERS,
    attendance: SEED_ATTENDANCE,
    rules: DEFAULT_RULES,
    payouts: SEED_PAYOUTS,
    transactions: SEED_TRANSACTIONS,
  });
}

export function getDb(): Db {
  if (g.__db) return g.__db;
  try {
    g.__db = JSON.parse(fs.readFileSync(FILE, "utf8")) as Db;
  } catch {
    g.__db = seed();
    saveDb();
  }
  return g.__db!;
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
