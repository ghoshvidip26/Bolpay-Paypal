import "server-only";
import { connection, NextResponse } from "next/server";
import { getSnapshot, ServiceError } from "./service";

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

/** Runs a service call and answers with the fresh state snapshot (plus any extras). */
export async function respond(fn: () => Promise<Record<string, unknown> | void> | Record<string, unknown> | void) {
  // The database is read synchronously from disk, so without this Cache Components would
  // prerender GET handlers at build time and serve a frozen snapshot.
  await connection();
  try {
    const extra = await fn();
    return NextResponse.json({ state: getSnapshot(), ...(extra ?? {}) });
  } catch (err) {
    if (err instanceof ServiceError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
