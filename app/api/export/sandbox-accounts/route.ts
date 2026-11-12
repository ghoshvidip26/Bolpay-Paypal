import { connection } from "next/server";
import { guard, OWNER, withRequestWorkspace } from "@/app/lib/server/http";
import { sandboxAccountsCsv } from "@/app/lib/server/sandbox";

/**
 * GET ?part=1: CSV for PayPal's "Create bulk accounts" dialog (developer.paypal.com, Testing tools,
 * Sandbox accounts). Up to 40 accounts per file; use part=2, 3... for more. Owners only.
 */
export async function GET(req: Request) {
  await connection();
  const denied = await guard(OWNER);
  if (denied) return denied;
  const part = Math.max(1, Number(new URL(req.url).searchParams.get("part")) || 1);
  const { csv, parts } = await withRequestWorkspace(async () => sandboxAccountsCsv(part));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bolpay-sandbox-accounts-part${part}-of-${parts}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
