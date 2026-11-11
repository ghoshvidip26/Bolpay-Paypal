"use client";

import { readPreferences } from "./preferences";

/**
 * Interface sounds, synthesized with the Web Audio API (no audio files to load).
 * Outcome sounds (success, payment, error...) follow the "Sound effects" setting; the quiet
 * click sounds (tap, toggleOn, toggleOff) also need "Click sounds". Hovering never makes a sound.
 */
export type SoundName = "success" | "payment" | "error" | "attention" | "notify" | "micOn" | "micOff" | "tap" | "toggleOn" | "toggleOff";

const CLICK_SOUNDS = new Set<SoundName>(["tap", "toggleOn", "toggleOff"]);

interface Tone {
  /** Start frequency in Hz. */
  f: number;
  /** End frequency for a glide. */
  to?: number;
  /** Start offset and length in seconds. */
  at: number;
  len: number;
  wave?: OscillatorType;
  /** Relative loudness, 1 = normal. */
  level?: number;
}

const SOUNDS: Record<SoundName, Tone[]> = {
  // Two rising notes: something was saved or approved.
  success: [
    { f: 659.25, at: 0, len: 0.1 },
    { f: 987.77, at: 0.075, len: 0.16 },
  ],
  // Bright three-note arpeggio: money reached a worker.
  payment: [
    { f: 1046.5, at: 0, len: 0.09, level: 0.8 },
    { f: 1318.51, at: 0.07, len: 0.09, level: 0.8 },
    { f: 1567.98, at: 0.14, len: 0.28, level: 0.9 },
  ],
  // Low, falling and soft: something failed.
  error: [
    { f: 329.63, at: 0, len: 0.13, wave: "triangle" },
    { f: 246.94, at: 0.12, len: 0.22, wave: "triangle" },
  ],
  // Two even pulses: a decision is needed (for example confirming a payout).
  attention: [
    { f: 698.46, at: 0, len: 0.09 },
    { f: 698.46, at: 0.15, len: 0.12 },
  ],
  // Single soft blip: an update or a reply arrived.
  notify: [{ f: 880, at: 0, len: 0.14, level: 0.7 }],
  micOn: [{ f: 523.25, to: 783.99, at: 0, len: 0.09, level: 0.7 }],
  micOff: [{ f: 783.99, to: 523.25, at: 0, len: 0.09, level: 0.7 }],
  // Clicks: very short and quiet, so they confirm a press without getting tiring.
  tap: [{ f: 1760, to: 1320, at: 0, len: 0.028, wave: "triangle", level: 0.32 }],
  toggleOn: [{ f: 880, to: 1320, at: 0, len: 0.05, wave: "triangle", level: 0.38 }],
  toggleOff: [{ f: 1320, to: 880, at: 0, len: 0.05, wave: "triangle", level: 0.34 }],
};

type AudioCtor = typeof AudioContext;
let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor: AudioCtor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  // Browsers start audio suspended until the page has had a user gesture.
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

const PEAK = 0.16;

/** Plays a named sound at `volume` (defaults to the saved preference). Respects the sound setting unless `force`. */
export function playSound(name: SoundName, opts: { force?: boolean; volume?: number } = {}) {
  const prefs = readPreferences();
  if (!opts.force && (!prefs.sounds || (CLICK_SOUNDS.has(name) && !prefs.clickSounds))) return;
  const volume = opts.volume ?? prefs.volume;
  if (volume <= 0) return;
  const ac = context();
  if (!ac) return;

  try {
    const start = ac.currentTime + 0.01;
    const out = ac.createGain();
    out.gain.value = PEAK * volume;
    out.connect(ac.destination);

    for (const tone of SOUNDS[name]) {
      const osc = ac.createOscillator();
      const env = ac.createGain();
      const t0 = start + tone.at;
      const t1 = t0 + tone.len;
      osc.type = tone.wave ?? "sine";
      osc.frequency.setValueAtTime(tone.f, t0);
      if (tone.to) osc.frequency.exponentialRampToValueAtTime(tone.to, t1);
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.exponentialRampToValueAtTime(tone.level ?? 1, t0 + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, t1);
      osc.connect(env).connect(out);
      osc.start(t0);
      osc.stop(t1 + 0.02);
    }
  } catch {
    /* audio is a nice-to-have; never break the page over it */
  }
}
