import { connection, NextResponse } from "next/server";
import { getSnapshot } from "@/app/lib/server/service";
import { handleTurn, peekSession } from "@/app/lib/voice/session";

const MAX_TEXT = 600;

/**
 * POST { sessionId?, text?, action?: "confirm" | "cancel", dryRun?, reset? }
 * One conversational turn. The session (pending question or pending plan) lives on the server, so it
 * survives the panel closing, the mic being tapped again, or the page reloading.
 * Returns the turn view plus `snapshot`, the latest app data, so the UI can refresh.
 */
export async function POST(req: Request) {
  await connection();
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Malformed JSON body" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text : undefined;
  if (text && text.length > MAX_TEXT) return NextResponse.json({ error: `Commands are limited to ${MAX_TEXT} characters.` }, { status: 413 });
  const action = body.action === "confirm" || body.action === "cancel" ? body.action : undefined;
  const view = await handleTurn({
    sessionId: typeof body.sessionId === "string" ? body.sessionId : null,
    text,
    action,
    dryRun: body.dryRun === true,
    reset: body.reset === true,
  });
  return NextResponse.json({ ...view, snapshot: getSnapshot() });
}

/** GET ?sessionId=... restores the last turn view after a reload. */
export async function GET(req: Request) {
  await connection();
  const id = new URL(req.url).searchParams.get("sessionId");
  const view = id ? peekSession(id) : null;
  return view ? NextResponse.json(view) : NextResponse.json({ error: "No such session" }, { status: 404 });
}
