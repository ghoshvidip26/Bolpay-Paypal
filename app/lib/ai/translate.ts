import "server-only";
import { groqChat, IntentModelError } from "./intent";

const LANGUAGE_NAMES: Record<string, string> = {
  hi: "Hindi", kn: "Kannada", ta: "Tamil", bn: "Bengali", te: "Telugu", mr: "Marathi", gu: "Gujarati", ml: "Malayalam", pa: "Punjabi", ur: "Urdu",
};

/**
 * Translates a short, server-generated reply into the manager's language so it can be read aloud.
 * Pure translation: the facts come from the database, and every number must survive unchanged.
 * Returns null (caller keeps English) on any failure or if the translation drops or changes a number.
 */
export async function translateReply(text: string, languageCode: string): Promise<string | null> {
  const language = LANGUAGE_NAMES[languageCode];
  if (!language) return null; // English or a language we don't speak back in
  try {
    const out = (
      await groqChat({
        response: "text",
        maxTokens: 500,
        messages: [
          {
            role: "system",
            content: `Translate the user's message into ${language}. Output only the translation. Keep every number, digit and person's name exactly as written (names may be transliterated). Do not add, remove or reinterpret anything.`,
          },
          { role: "user", content: text },
        ],
      })
    ).trim();
    if (!out || out.length > 600) return null;
    // Guard: the same digits must appear in the same order.
    const digits = (s: string) => (s.match(/\d+/g) ?? []).join(",");
    return digits(out) === digits(text) ? out : null;
  } catch (err) {
    if (!(err instanceof IntentModelError)) console.error("Translation failed", err);
    return null;
  }
}
