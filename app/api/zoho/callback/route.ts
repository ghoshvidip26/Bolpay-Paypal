import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { guard, OWNER } from "@/app/lib/server/http";
import { exchangeCode, ZohoError } from "@/app/lib/zoho/client";

/** GET: where Zoho sends the owner back after consent. Checks the state value, then stores the tokens. */
export async function GET(req: Request) {
  const denied = await guard(OWNER);
  if (denied) return denied;
  const url = new URL(req.url);
  const back = (q: string) => NextResponse.redirect(new URL(`/integrations?${q}`, req.url));
  const jar = await cookies();
  const expected = jar.get("zoho_oauth_state")?.value;
  jar.delete("zoho_oauth_state");

  const oauthError = url.searchParams.get("error");
  if (oauthError) return back(`zoho=error&reason=${encodeURIComponent(oauthError)}`);
  const code = url.searchParams.get("code");
  if (!code || !expected || url.searchParams.get("state") !== expected) return back("zoho=error&reason=invalid_state");
  try {
    await exchangeCode(code);
    return back("zoho=connected");
  } catch (err) {
    return back(`zoho=error&reason=${encodeURIComponent(err instanceof ZohoError ? err.message : "Could not finish the Zoho sign-in.")}`);
  }
}
