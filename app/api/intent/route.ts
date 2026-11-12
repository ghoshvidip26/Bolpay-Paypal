import { NextResponse } from "next/server";
import { connection } from "next/server";
import { IntentModelError } from "@/app/lib/ai/intent";
import { planFromText } from "@/app/lib/server/intent-service";
import type { IntentContext } from "@/app/lib/merchant/intent-types";
import { guard, STAFF, withRequestWorkspace } from "@/app/lib/server/http";

const MAX_TEXT = 500;

/**
 * POST /api/intent  { text: string, context?: { previousText, question } }
 * Returns { plan }, a validated action for the UI to confirm. Nothing is executed here.
 */
export async function POST(req: Request) {
  const denied = await guard(STAFF);
  if (denied) return denied;
  await connection();

  let body: { text?: unknown; context?: { previousText?: unknown; question?: unknown } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON body" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Say or type a command first." }, { status: 400 });
  if (text.length > MAX_TEXT) return NextResponse.json({ error: `Commands are limited to ${MAX_TEXT} characters.` }, { status: 413 });

  let context: IntentContext | undefined;
  if (typeof body.context?.previousText === "string" && typeof body.context.question === "string") {
    context = { previousText: body.context.previousText.slice(0, MAX_TEXT), question: body.context.question.slice(0, MAX_TEXT) };
  }

  try {
    return NextResponse.json({ plan: await withRequestWorkspace(() => planFromText(text, context)) });
  } catch (err) {
    if (err instanceof IntentModelError) {
      const status = err.kind === "not_configured" ? 503 : err.kind === "rate_limited" ? 429 : 502;
      return NextResponse.json({ error: err.message, code: err.kind }, { status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
