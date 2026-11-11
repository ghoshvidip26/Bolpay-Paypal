"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Per-device interface preferences, kept in localStorage. */
export interface Preferences {
  /** Master switch for every sound. */
  sounds: boolean;
  /** Quiet clicks when pressing buttons, switches and tabs. */
  clickSounds: boolean;
  /** 0 to 1. */
  volume: number;
  /** Pop-up notices when a PayPal payment completes or fails. */
  paymentAlerts: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = { sounds: true, clickSounds: true, volume: 0.6, paymentAlerts: true };

const KEY = "bolpay.preferences";
const listeners = new Set<() => void>();

// useSyncExternalStore needs the same object back while nothing changed, so cache by raw string.
let cachedRaw: string | null | undefined;
let cached: Preferences = DEFAULT_PREFERENCES;

export function readPreferences(): Preferences {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return DEFAULT_PREFERENCES;
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<Preferences>) : {};
    cached = {
      sounds: typeof parsed.sounds === "boolean" ? parsed.sounds : DEFAULT_PREFERENCES.sounds,
      clickSounds: typeof parsed.clickSounds === "boolean" ? parsed.clickSounds : DEFAULT_PREFERENCES.clickSounds,
      volume: typeof parsed.volume === "number" ? Math.min(1, Math.max(0, parsed.volume)) : DEFAULT_PREFERENCES.volume,
      paymentAlerts: typeof parsed.paymentAlerts === "boolean" ? parsed.paymentAlerts : DEFAULT_PREFERENCES.paymentAlerts,
    };
  } catch {
    cached = DEFAULT_PREFERENCES;
  }
  return cached;
}

function writePreferences(patch: Partial<Preferences>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readPreferences(), ...patch }));
  } catch {
    /* storage blocked: the change lasts until reload */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb); // other tabs
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function usePreferences() {
  const prefs = useSyncExternalStore(subscribe, readPreferences, () => DEFAULT_PREFERENCES);
  const update = useCallback((patch: Partial<Preferences>) => writePreferences(patch), []);
  return [prefs, update] as const;
}
