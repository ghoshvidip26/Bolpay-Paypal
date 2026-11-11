import { connection, NextResponse } from "next/server";
import { synthesizeSpeech } from "@/app/lib/elevanlabs/client";
import { guard, STAFF } from "@/app/lib/server/http";

const MAX_CHARS = 400;

/**
 * POST /api/voice-output  { text: string }  ->  audio/mpeg
 * Reads a short assistant reply aloud with ElevenLabs text-to-speech.
 * Callers should only send reply text, never recipient details (emails, bank info).
 */
export async function POST(req: Request) {
  const denied = await guard(STAFF);
  if (denied) return denied;
  await connection();
  if (!process.env.ELEVEN_LABS_API_KEY) {
    return NextResponse.json({ error: "Text-to-speech is not configured." }, { status: 503 });
  }

  let text = "";
  try {
    const body = (await req.json()) as { text?: unknown };
    text = typeof body.text === "string" ? body.text.trim() : "";
  } catch {
    return NextResponse.json({ error: "Malformed JSON body" }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: "Nothing to say." }, { status: 400 });
  if (text.length > MAX_CHARS) return NextResponse.json({ error: `Replies are limited to ${MAX_CHARS} characters.` }, { status: 413 });

  try {
    const audio = await synthesizeSpeech(text);
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("ElevenLabs TTS failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not generate speech." }, { status: 502 });
  }
}
