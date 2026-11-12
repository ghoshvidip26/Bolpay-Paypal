#!/usr/bin/env node
/**
 * Renders the demo video narration with ElevenLabs text-to-speech.
 *
 *   NARRATOR_VOICE_ID=sXcl1NoQHcU7NRh6Na5D node scripts/demo-narration.mjs
 *   node scripts/demo-narration.mjs N3 M1        only these clips
 *
 * Reads ELEVEN_LABS_API_KEY from the environment or .env. Text, model and clip ids live in
 * docs/demo-video/narration.json. Output: demo-assets/audio/narrator and demo-assets/audio/manager
 * (ignored by git), with the measured length of each clip.
 *
 * Environment: NARRATOR_VOICE_ID (required), MANAGER_VOICE_ID (default: the premade voice Sarah),
 * ELEVEN_MODEL (default: the model in narration.json).
 * Note: ElevenLabs only allows library voices through the API on a paid plan; on the free plan use the
 * website (see docs/DEMO_VIDEO.md) or a premade voice.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env };
if (existsSync(join(root, ".env"))) {
  for (const l of readFileSync(join(root, ".env"), "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}
const key = env.ELEVEN_LABS_API_KEY;
const narratorVoice = env.NARRATOR_VOICE_ID;
const managerVoice = env.MANAGER_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
if (!key) throw new Error("ELEVEN_LABS_API_KEY is not set");
if (!narratorVoice) throw new Error("Set NARRATOR_VOICE_ID (for example sXcl1NoQHcU7NRh6Na5D)");

const script = JSON.parse(readFileSync(join(root, "docs/demo-video/narration.json"), "utf8"));
const model = env.ELEVEN_MODEL || script.model;
const only = new Set(process.argv.slice(2));
const jobs = [
  ...script.narrator.map((c) => ({ ...c, voice: narratorVoice, dir: "narrator" })),
  ...script.manager.map((c) => ({ ...c, voice: managerVoice, dir: "manager" })),
].filter((c) => only.size === 0 || only.has(c.id));

let chars = 0;
for (const c of jobs) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${c.voice}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text: c.text, model_id: model }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`${c.id}: HTTP ${res.status} ${body.slice(0, 220)}`);
    if (res.status === 402) console.error("This voice needs a paid ElevenLabs plan over the API. Use the website instead, or another voice.");
    process.exitCode = 1;
    break;
  }
  const audio = Buffer.from(await res.arrayBuffer());
  const dir = join(root, "demo-assets/audio", c.dir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${c.id}.mp3`), audio);
  chars += c.text.length;
  console.log(`${c.id.padEnd(4)} ${(audio.length / 16000).toFixed(1).padStart(5)} s  (${c.dir})`); // 128 kbps = 16000 bytes per second
}
if (!process.exitCode) console.log(`done: ${jobs.length} clips, ${chars} characters, model ${model}`);
