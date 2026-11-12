import "server-only";
import type { Worker } from "@/app/lib/merchant/types";
import { getDb, logAudit, saveDb } from "./db";

/**
 * Helpers for testing payouts against the PayPal SANDBOX.
 * PayPal has no API to create or delete sandbox accounts (only the dashboard and a bulk CSV upload), and a live
 * account can never be created on someone's behalf: a recipient without an account gets a sign-up link by email
 * (the payment shows as "awaiting PayPal sign-up"). So for tests we (1) give employees without an email a
 * sandbox test address and (2) export the CSV that PayPal's "Create bulk accounts" dialog accepts.
 */
export const SANDBOX_DOMAIN = "personal.example.com";
export const SANDBOX_PASSWORD = "BolPaySbx#2026";
const BULK_LIMIT = 40; // PayPal accepts up to 40 accounts per upload

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const aliasFor = (w: Worker) => `bolpay-${slug((w.externalId ?? w.id).replace(/^zoho:/, ""))}@${SANDBOX_DOMAIN}`;
const isSandboxEmail = (e: string) => e.toLowerCase().endsWith(`@${SANDBOX_DOMAIN}`);

/** Gives every active employee with no PayPal email a sandbox test address. Never touches an existing email. */
export function assignSandboxEmails(): { assigned: number; alreadyHadEmail: number } {
  const db = getDb();
  let assigned = 0;
  let had = 0;
  for (const w of db.workers) {
    if (w.status !== "active") continue;
    if (w.payoutEmail) {
      had++;
      continue;
    }
    w.payoutEmail = aliasFor(w);
    assigned++;
  }
  if (assigned) {
    logAudit("sandbox.assign_emails", `${assigned} sandbox test emails assigned`);
    saveDb();
  }
  return { assigned, alreadyHadEmail: had };
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV in the exact column layout of PayPal's bulk sandbox account template, for the workers that use a sandbox address. */
export function sandboxAccountsCsv(part: number): { csv: string; accounts: number; parts: number } {
  const all = getDb().workers.filter((w) => w.status === "active" && isSandboxEmail(w.payoutEmail));
  const parts = Math.max(1, Math.ceil(all.length / BULK_LIMIT));
  const slice = all.slice((Math.max(1, part) - 1) * BULK_LIMIT, Math.max(1, part) * BULK_LIMIT);
  const header = "country_code,account_type,primary_email_alias,password,first_name,last_name,ppBalance,addBank,ccType,payment_card";
  const lines = slice.map((w) => {
    const [first, ...rest] = w.name.trim().split(/\s+/);
    return ["US", "PERSONAL", w.payoutEmail, SANDBOX_PASSWORD, first || "BolPay", rest.join(" ") || "Employee", "100", "N", "VISA", "PAYPAL"].map(csvCell).join(",");
  });
  return { csv: [header, ...lines].join("\n") + "\n", accounts: slice.length, parts };
}

/** How many active employees can receive a payout right now. */
export function emailReadiness(ws?: Parameters<typeof getDb>[0]) {
  const active = getDb(ws).workers.filter((w) => w.status === "active");
  const withEmail = active.filter((w) => w.payoutEmail).length;
  return { active: active.length, withEmail, withoutEmail: active.length - withEmail, sandbox: active.filter((w) => isSandboxEmail(w.payoutEmail)).length };
}
