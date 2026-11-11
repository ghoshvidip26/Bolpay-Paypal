import "server-only";
import { connection, NextResponse } from "next/server";
import { getSession, type Role, type SessionContext } from "@/app/lib/auth/dal";
import { getSnapshot, ServiceError } from "./service";

/** Owners and supervisors run the business; workers only see their own pay page. */
export const STAFF: Role[] = ["owner", "supervisor"];
/** Anything that moves money or changes wages, rules or the team. */
export const OWNER: Role[] = ["owner"];

/** Verifies the caller's session and role, or throws a 401/403 ServiceError. */
export async function requireApiRole(roles: Role[]): Promise<SessionContext> {
  const session = await getSession();
  if (!session) throw new ServiceError("Sign in first.", 401);
  if (!roles.includes(session.role)) throw new ServiceError("Your role isn't allowed to do this.", 403);
  return session;
}

/** For routes that don't use respond(): returns an error response, or null when allowed. */
export async function guard(roles: Role[]): Promise<NextResponse | null> {
  try {
    await requireApiRole(roles);
    return null;
  } catch (err) {
    const e = err as ServiceError;
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}

/** Reads a JSON object body, or throws a 400. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  throw new ServiceError("Malformed JSON body");
}

/**
 * Checks the caller's role (staff by default), runs a service call and answers with the
 * fresh state snapshot (plus any extras).
 */
export async function respond(
  fn: () => Promise<Record<string, unknown> | void> | Record<string, unknown> | void,
  roles: Role[] = STAFF,
) {
  // The database is read synchronously from disk, so without this Cache Components would
  // prerender GET handlers at build time and serve a frozen snapshot.
  await connection();
  try {
    await requireApiRole(roles);
    const extra = await fn();
    return NextResponse.json({ state: getSnapshot(), ...(extra ?? {}) });
  } catch (err) {
    if (err instanceof ServiceError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
