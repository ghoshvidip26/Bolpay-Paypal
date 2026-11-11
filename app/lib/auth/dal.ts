import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

export type Role = "owner" | "supervisor" | "worker";

export interface SessionContext {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
  business: { id: string; name: string };
  /** Worker record id in the app data (e.g. "w1") for worker logins. */
  workerRef: string | null;
}

/**
 * Verified session + membership for the current request, or null when signed
 * out or not a member of any business. Memoized per render pass.
 */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  // Token checks depend on the clock, so this always runs per request.
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const claims = auth?.claims;
  if (!claims?.sub) return null;

  const { data: member } = await supabase
    .from("members")
    .select("role, business_id, worker_ref")
    .eq("user_id", claims.sub)
    .limit(1)
    .maybeSingle();
  if (!member) return null;

  const { data: business } = await supabase.from("businesses").select("name").eq("id", member.business_id).maybeSingle();

  const meta = (claims.user_metadata ?? {}) as { full_name?: string };
  const email = typeof claims.email === "string" ? claims.email : "";
  return {
    userId: claims.sub,
    email,
    displayName: meta.full_name || email,
    role: member.role,
    business: { id: member.business_id, name: business?.name ?? "" },
    workerRef: member.worker_ref,
  };
});

/** Use at the top of a page: redirects unless the user has one of `roles`. */
export async function requireRole(roles: Role[]): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!roles.includes(session.role)) redirect(homeFor(session.role));
  return session;
}

export function homeFor(role: Role) {
  return role === "worker" ? "/me" : role === "supervisor" ? "/attendance" : "/dashboard";
}
