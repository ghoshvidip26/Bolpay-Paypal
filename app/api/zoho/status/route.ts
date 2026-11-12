import { OWNER, respond } from "@/app/lib/server/http";
import { getDb, getWorkspace } from "@/app/lib/server/db";
import { emailReadiness } from "@/app/lib/server/sandbox";
import { connection, readZoho, zohoConfig, zohoConfigured } from "@/app/lib/zoho/client";

/** GET: whether Zoho is configured and connected, the last sync, and what the Zoho dataset holds. Owners only. */
export async function GET() {
  return respond(() => {
    const c = zohoConfig();
    const stored = readZoho();
    const db = getDb("zoho");
    return {
      zoho: {
        configured: zohoConfigured(),
        connection: connection(),
        connectedAt: stored.connectedAt ?? null,
        lastSync: stored.lastSync ?? null,
        workspace: getWorkspace(),
        workers: db.workers.length,
        attendance: db.attendance.length,
        emails: emailReadiness("zoho"),
        accountsUrl: c.accountsUrl,
        peopleUrl: c.peopleUrl,
        redirectUri: c.redirectUri,
        scopes: c.scopes,
        defaultWage: c.defaultWage,
        wageField: c.wageField ?? null,
        payoutEmailField: c.payoutEmailField ?? null,
      },
    };
  }, OWNER);
}
