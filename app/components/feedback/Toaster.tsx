"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { playSound, type SoundName } from "@/app/lib/client/sounds";
import { IconAlert, IconClose, IconDone, IconInfo } from "../icons";

type Tone = "success" | "error" | "warn" | "info";

export interface ToastInput {
  tone?: Tone;
  title: string;
  description?: string;
  /** A link (href) or a button (onClick). Using it closes the toast. */
  action?: { label: string; href?: string; onClick?: () => void };
  /** Sound to play; defaults by tone. `false` for silence. */
  sound?: SoundName | false;
  /** Milliseconds before it closes on its own. */
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

const DEFAULT_SOUND: Record<Tone, SoundName> = { success: "success", error: "error", warn: "attention", info: "notify" };
const DEFAULT_DURATION: Record<Tone, number> = { success: 4500, info: 5000, warn: 7000, error: 8000 };
const ICON = {
  success: { Icon: IconDone, cls: "text-emerald-600" },
  error: { Icon: IconAlert, cls: "text-rose-600" },
  warn: { Icon: IconAlert, cls: "text-amber-600" },
  info: { Icon: IconInfo, cls: "text-sky-600" },
};
const MAX_VISIBLE = 4;

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback((input: ToastInput) => {
    const tone = input.tone ?? "info";
    const sound = input.sound === undefined ? DEFAULT_SOUND[tone] : input.sound;
    if (sound) playSound(sound);
    const id = nextId.current++;
    setItems((list) => [...list, { ...input, tone, id }].slice(-MAX_VISIBLE));
  }, []);

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext value={value}>
      {children}
      <section
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-3 top-3 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4 sm:top-4 sm:w-[22rem]"
      >
        {items.map((t) => (
          <Toast key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </section>
    </ToastContext>
  );
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const tone = item.tone ?? "info";
  const [paused, setPaused] = useState(false);
  const duration = item.duration ?? DEFAULT_DURATION[tone];
  const onClose = useCallback(() => onDismiss(item.id), [onDismiss, item.id]);

  useEffect(() => {
    if (paused) return;
    const handle = setTimeout(onClose, duration);
    return () => clearTimeout(handle);
  }, [paused, duration, onClose]);

  const { Icon, cls } = ICON[tone];
  const actionCls = "text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline";

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex w-full animate-toast-in items-start gap-2.5 rounded-lg border border-slate-200 bg-white px-3.5 py-3 shadow-[0_6px_20px_-6px_rgba(15,23,42,0.18)]"
    >
      <Icon className={`mt-px size-4 shrink-0 ${cls}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">{item.title}</p>
        {item.description && <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{item.description}</p>}
        {item.action && (
          <div className="mt-1.5">
            {item.action.href ? (
              <Link href={item.action.href} onClick={onClose} className={actionCls}>{item.action.label}</Link>
            ) : (
              <button type="button" onClick={() => { item.action?.onClick?.(); onClose(); }} className={actionCls}>{item.action.label}</button>
            )}
          </div>
        )}
      </div>
      <button type="button" onClick={onClose} aria-label="Dismiss notification" className="-mr-1 -mt-0.5 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
        <IconClose className="size-3.5" />
      </button>
    </div>
  );
}
