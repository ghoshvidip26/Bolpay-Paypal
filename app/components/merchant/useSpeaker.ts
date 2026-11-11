"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const MUTE_KEY = "bolpay.voiceReplies";

// Voice-reply preference lives in localStorage; useSyncExternalStore keeps it hydration-safe.
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};
const readEnabled = () => {
  try {
    return localStorage.getItem(MUTE_KEY) !== "off";
  } catch {
    return true;
  }
};
const writeEnabled = (on: boolean) => {
  try {
    localStorage.setItem(MUTE_KEY, on ? "on" : "off");
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
};

export type SpeakResult = "played" | "blocked" | "unavailable";

/**
 * Reads assistant replies aloud via /api/voice-output (ElevenLabs).
 * Failures never throw: callers show the reply as text regardless.
 */
export function useSpeaker() {
  const enabled = useSyncExternalStore(subscribe, readEnabled, () => true);
  const [speaking, setSpeaking] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const objectUrl = useRef<string | null>(null);
  const requestId = useRef(0);

  const stop = useCallback(() => {
    requestId.current += 1; // invalidates any in-flight request
    audio.current?.pause();
    audio.current = null;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setSpeaking(false);
  }, []);

  useEffect(() => stop, [stop]);

  const speak = useCallback(
    async (text: string, opts: { force?: boolean } = {}): Promise<SpeakResult> => {
      if ((!enabled && !opts.force) || !text.trim()) return "unavailable";
      stop();
      const id = requestId.current;
      try {
        const res = await fetch("/api/voice-output", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) return "unavailable";
        const blob = await res.blob();
        if (id !== requestId.current) return "unavailable"; // superseded by a newer reply or stop()
        const url = URL.createObjectURL(blob);
        objectUrl.current = url;
        const el = new Audio(url);
        audio.current = el;
        el.onended = () => stop();
        el.onerror = () => stop();
        setSpeaking(true);
        try {
          await el.play();
          return "played";
        } catch {
          stop();
          return "blocked"; // browser autoplay policy: needs a tap
        }
      } catch {
        return "unavailable";
      }
    },
    [enabled, stop],
  );

  const setEnabled = useCallback(
    (on: boolean) => {
      writeEnabled(on);
      if (!on) stop();
    },
    [stop],
  );

  return { enabled, setEnabled, speaking, speak, stop };
}
