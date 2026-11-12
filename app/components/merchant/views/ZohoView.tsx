"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatDateTime } from "@/app/lib/merchant/format";
import { useStore, type Snapshot } from "@/app/lib/merchant/store";
import { Badge, Button, buttonClass, Card, Notice, PageHeader, Stat, Stats } from "../ui";

interface Status {
  configured: boolean;
  connection: "oauth" | "env" | null;
  connectedAt: string | null;
  lastSync: SyncSummary | null;
  workspace: "demo" | "zoho";
  workers: number;
  attendance: number;
  emails: { active: number; withEmail: number; withoutEmail: number; sandbox: number };
  accountsUrl: string;
  peopleUrl: string;
  redirectUri: string;
  scopes: string;
  defaultWage: number;
  wageField: string | null;
  payoutEmailField: string | null;
}

interface SyncSummary {
  at: string;
  employees: { total: number; created: number; updated: number; inactive: number };
  attendance: { records: number; employees: number; from: string; to: string } | null;
  warnings: string[];
}

export function ZohoView() {
  const params = useSearchParams();
  const store = useStore();
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"sync" | "disconnect" | "open" | "emails" | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string; sync?: SyncSummary } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/zoho/status");
    const d = (await res.json().catch(() => ({}))) as { zoho?: Status; error?: string };
    if (res.ok && d.zoho) setStatus(d.zoho);
    else setLoadError(d.error ?? "Could not load the Zoho status.");
  }, []);

  useEffect(() => {
    // Initial load; the fetch is the external system being synced with.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function sync() {
    setBusy("sync");
    setResult(null);
    const res = await fetch("/api/zoho/sync", { method: "POST" });
    const d = (await res.json().catch(() => ({}))) as { sync?: SyncSummary; state?: Snapshot; error?: string };
    setBusy(null);
    // The screens keep their data in memory, so hand them the fresh server data or they show the old list until a reload.
    if (d.state) store.applySnapshot(d.state);
    setResult(res.ok && d.sync ? { ok: true, message: "Sync finished.", sync: d.sync } : { ok: false, message: d.error ?? "The sync failed." });
    await load();
  }

  async function disconnect() {
    setBusy("disconnect");
    await fetch("/api/zoho/sync", { method: "DELETE" });
    setBusy(null);
    setResult({ ok: true, message: "Disconnected from Zoho. The employees you already synced are still in the Zoho dataset." });
    await load();
  }

  async function assignEmails() {
    setBusy("emails");
    const res = await fetch("/api/workers/sandbox-emails", { method: "POST" });
    const d = (await res.json().catch(() => ({}))) as { sandbox?: { assigned: number }; state?: Snapshot; error?: string };
    setBusy(null);
    if (d.state) store.applySnapshot(d.state);
    setResult(res.ok && d.sandbox ? { ok: true, message: d.sandbox.assigned ? `Gave ${d.sandbox.assigned} employees a sandbox test email. Download the accounts CSV and upload it to PayPal next.` : "Every active employee already has a PayPal email." } : { ok: false, message: d.error ?? "Could not assign emails." });
    await load();
  }

  async function openZohoData() {
    setBusy("open");
    const res = await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace: "zoho" }) });
    if (res.ok) window.location.assign(new URL("/workers", window.location.origin).href);
    else setBusy(null);
  }

  const flag = params.get("zoho");
  const reason = params.get("reason");

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Bring employees and attendance from your HR system, then run payouts in BolPay. The demo data stays separate."
        actions={
          status?.workers ? (
            <Button variant="primary" disabled={busy !== null || status.workspace === "zoho"} onClick={() => void openZohoData()}>
              {status.workspace === "zoho" ? "Viewing Zoho data" : "Open Zoho data"}
            </Button>
          ) : undefined
        }
      />

      {flag === "connected" && <Notice tone="success" className="mb-4">Connected to Zoho People. Press Sync now to import your employees.</Notice>}
      {flag === "not_configured" && <Notice tone="warn" className="mb-4">Zoho is not configured yet. Add the keys below to .env and restart the server.</Notice>}
      {flag === "error" && <Notice tone="error" className="mb-4">Zoho sign-in did not finish{reason ? `: ${reason}` : ""}.</Notice>}
      {loadError && <Notice tone="error" className="mb-4">{loadError}</Notice>}

      <Card
        title="Zoho People"
        className="mb-4"
        actions={
          status && (
            <Badge tone={status.connection ? "green" : status.configured ? "amber" : "slate"}>
              {status.connection ? (status.connection === "oauth" ? "Connected" : "Connected (refresh token in .env)") : status.configured ? "Not connected" : "Not configured"}
            </Badge>
          )
        }
      >
        {!status ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Sign in with Zoho, then import every employee and this month&apos;s attendance from <span className="font-medium">{status.peopleUrl.replace("https://", "")}</span>. Run Sync now any time to pick up changes.
            </p>
            <div className="flex flex-wrap gap-2">
              {status.configured && (
                <a href="/api/zoho/connect" className={buttonClass(status.connection ? "secondary" : "primary")}>
                  {status.connection ? "Reconnect Zoho" : "Connect Zoho"}
                </a>
              )}
              <Button variant={status.connection ? "primary" : "secondary"} disabled={!status.connection || busy !== null} onClick={() => void sync()}>
                {busy === "sync" ? "Syncing…" : "Sync now"}
              </Button>
              {status.connection === "oauth" && (
                <Button variant="ghost" disabled={busy !== null} onClick={() => void disconnect()}>
                  Disconnect
                </Button>
              )}
            </div>
            {status.connectedAt && <p className="text-xs text-slate-500">Connected {formatDateTime(status.connectedAt)}.</p>}
          </div>
        )}
      </Card>

      {result && (
        <Notice tone={result.ok ? "success" : "error"} className="mb-4">
          <p className="font-medium">{result.message}</p>
          {result.sync && <SyncDetails s={result.sync} />}
        </Notice>
      )}

      {status && (
        <Stats className="mb-4">
          <Stat label="Employees in Zoho dataset" value={String(status.workers)} hint={status.lastSync ? `Last sync ${formatDateTime(status.lastSync.at)}` : "Not synced yet"} tone={status.workers ? "good" : "default"} />
          <Stat label="Attendance records" value={String(status.attendance)} hint="This month, from Zoho" />
          <Stat label="Default daily wage" value={`₹${status.defaultWage}`} hint="Zoho People holds no salary data" />
        </Stats>
      )}

      {status && status.workers > 0 && (
        <Card title="PayPal accounts for payouts" className="mb-4">
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              <span className="font-medium">{status.emails.withEmail}</span> of {status.emails.active} active employees have a PayPal email
              {status.emails.withoutEmail > 0 && <span className="text-amber-800"> ({status.emails.withoutEmail} have none, so their payouts will fail)</span>}.
              Zoho only supplies an email if it is filled in on the employee&apos;s profile; a later sync fills an empty one automatically.
            </p>
            <p className="text-slate-600">
              On live PayPal an employee without an account gets a sign-up link by email when you pay them, and the payment waits as <em>Awaiting PayPal sign-up</em> (you can cancel and refund it on Transactions). PayPal has no API to create or delete{" "}
              <span className="font-medium">sandbox</span> test accounts, so for testing use the two buttons below, then upload the CSV at developer.paypal.com → Testing tools → Sandbox accounts → Create bulk accounts (40 per file).
            </p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy !== null || status.workspace !== "zoho" || status.emails.withoutEmail === 0} onClick={() => void assignEmails()} title={status.workspace !== "zoho" ? "Switch the dataset to Zoho HRMS first" : undefined}>
                {busy === "emails" ? "Assigning…" : `Give ${status.emails.withoutEmail} employees a sandbox test email`}
              </Button>
              <a href="/api/export/sandbox-accounts" className={buttonClass("secondary")} aria-disabled={status.workspace !== "zoho" || status.emails.sandbox === 0}>
                Download sandbox accounts CSV ({status.emails.sandbox})
              </a>
            </div>
            {status.workspace !== "zoho" && <p className="text-xs text-slate-500">These act on the active dataset. Switch to Zoho HRMS in the sidebar first.</p>}
          </div>
        </Card>
      )}

      {status && !status.configured && (
        <Card title="Set up the connection (one time)" className="mb-4">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>
              Open <span className="font-medium">api-console.zoho.in</span>, choose <span className="font-medium">Add Client</span>, then <span className="font-medium">Server-based Applications</span>.
            </li>
            <li>
              Authorized Redirect URI: <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{status.redirectUri}</code>
            </li>
            <li>Copy the Client ID and Client Secret into .env as ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET, then restart the server.</li>
            <li>Come back here and press Connect Zoho. Requested access: <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{status.scopes}</code></li>
          </ol>
          <p className="mt-3 text-xs text-slate-500">Accounts server: {status.accountsUrl}. If your portal is not on the India data center, set ZOHO_ACCOUNTS_URL and ZOHO_PEOPLE_URL (see .env.example).</p>
        </Card>
      )}

      <Card title="How the import works">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
          <li>Employees become workers. Zoho owns the name, role, department, city, phone, joining date and active status, and updates them on every sync.</li>
          <li>Attendance for every day Zoho reports (present, absent, half day, leave, overtime) is imported. Weekends, holidays and days with nothing recorded are left alone, so you can still mark them in BolPay or by voice.</li>
          <li>
            Pay settings belong to BolPay. A new employee gets the default daily wage{status?.wageField ? ` (or the "${status.wageField}" field)` : ""} and their Zoho work email{status?.payoutEmailField ? ` (or the "${status.payoutEmailField}" field)` : ""} as the PayPal account. Edit them on Workers or by voice; a sync never overwrites them.
          </li>
          <li>Payouts, approvals and the voice assistant work on this data exactly as on the demo data. Use the Dataset switch in the sidebar to go back.</li>
        </ul>
      </Card>
    </>
  );
}

function SyncDetails({ s }: { s: SyncSummary }) {
  return (
    <div className="mt-1 space-y-1 text-sm font-normal">
      <p>
        {s.employees.total} employees: {s.employees.created} new, {s.employees.updated} updated, {s.employees.inactive} inactive.
      </p>
      {s.attendance && (
        <p>
          Attendance {s.attendance.from} to {s.attendance.to}: {s.attendance.records} records for {s.attendance.employees} employees.
        </p>
      )}
      {s.warnings.map((w) => (
        <p key={w} className="text-amber-800">
          {w}
        </p>
      ))}
    </div>
  );
}
