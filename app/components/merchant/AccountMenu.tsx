"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { signOut } from "@/app/login/actions";
import { initials } from "@/app/lib/merchant/format";
import { IconChevron, IconDoc, IconSettings, IconSignOut } from "../icons";

const item = "flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus-visible:bg-slate-100 focus-visible:outline-none";

/** The signed-in person, with Settings, legal pages and Sign out in a small menu. */
export function AccountMenu({ name, role, compact = false }: { name: string; role: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={compact ? `Account menu for ${name}` : undefined}
        className={`flex items-center gap-2.5 rounded-md text-left hover:bg-slate-100 ${compact ? "p-1" : "w-full px-2 py-1.5"} ${open ? "bg-slate-100" : ""}`}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-teal-700 text-[10px] font-semibold text-white">{initials(name)}</span>
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">{name}</span>
              <span className="block text-xs text-slate-500">{role}</span>
            </span>
            <IconChevron className={`size-4 shrink-0 text-slate-400 transition-transform ${open ? "" : "rotate-180"}`} />
          </>
        )}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className={`absolute z-30 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-[0_10px_28px_-10px_rgba(15,23,42,0.28)] ${compact ? "right-0 top-full mt-1.5" : "bottom-full left-0 mb-1.5"}`}
        >
          <div className="px-2.5 pb-2 pt-1.5">
            <p className="truncate text-sm font-medium text-slate-900">{name}</p>
            <p className="text-xs text-slate-500">{role}</p>
          </div>
          <div className="my-1 h-px bg-slate-100" />
          <Link role="menuitem" href="/settings" onClick={() => setOpen(false)} className={item}>
            <IconSettings className="size-4 text-slate-400" /> Settings
          </Link>
          <Link role="menuitem" href="/terms" onClick={() => setOpen(false)} className={item}>
            <IconDoc className="size-4 text-slate-400" /> Terms of Service
          </Link>
          <Link role="menuitem" href="/privacy" onClick={() => setOpen(false)} className={item}>
            <IconDoc className="size-4 text-slate-400" /> Privacy Policy
          </Link>
          <div className="my-1 h-px bg-slate-100" />
          <form action={signOut}>
            <button role="menuitem" type="submit" className={item}>
              <IconSignOut className="size-4 text-slate-400" /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
