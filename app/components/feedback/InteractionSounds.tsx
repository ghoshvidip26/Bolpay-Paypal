"use client";

import { useEffect } from "react";
import { playSound } from "@/app/lib/client/sounds";

const CLICKABLE = 'button, a[href], [role="switch"], [role="tab"], [role="menuitem"], input[type="checkbox"], input[type="radio"], summary';

/**
 * One document-level listener that gives every press a quiet click (switches get an on/off tone).
 * Mark an element, or any parent, with data-sound="off" when it plays its own sound.
 */
export function InteractionSounds() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.button !== 0) return;
      const el = (e.target as Element | null)?.closest?.(CLICKABLE);
      if (!(el instanceof HTMLElement)) return;
      if (el.matches(":disabled") || el.getAttribute("aria-disabled") === "true" || el.closest('[data-sound="off"]')) return;

      if (el.getAttribute("role") === "switch") {
        // Capture phase: aria-checked still holds the value before this press.
        playSound(el.getAttribute("aria-checked") === "true" ? "toggleOff" : "toggleOn");
      } else if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
        // The browser has already flipped `checked` by the time click fires.
        playSound(el.checked ? "toggleOn" : "toggleOff");
      } else {
        playSound("tap");
      }
    }
    function onChange(e: Event) {
      if (e.target instanceof HTMLSelectElement && !e.target.closest('[data-sound="off"]')) playSound("tap");
    }
    document.addEventListener("click", onClick, true);
    document.addEventListener("change", onChange, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("change", onChange, true);
    };
  }, []);
  return null;
}
