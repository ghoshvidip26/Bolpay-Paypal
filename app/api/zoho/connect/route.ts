import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { guard, OWNER } from "@/app/lib/server/http";
import { authorizeUrl, zohoConfigured } from "@/app/lib/zoho/client";

/** GET: starts "Connect Zoho". Sends the signed-in owner to Zoho's consent screen with a one-time state value. */
export async function GET(req: Request) {
  const denied = await guard(OWNER);
  if (denied) return denied;
  if (!zohoConfigured()) return NextResponse.redirect(new URL("/integrations?zoho=not_configured", req.url));
  const state = randomBytes(16).toString("hex");
  (await cookies()).set("zoho_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/zoho", maxAge: 600 });
  return NextResponse.redirect(authorizeUrl(state));
}
