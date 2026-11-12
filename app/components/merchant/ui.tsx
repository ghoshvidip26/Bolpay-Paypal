import type { ReactNode } from "react";
import { initials } from "@/app/lib/merchant/format";
import { IconAlert, IconDone, IconInfo } from "../icons";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = "", flush = false }: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    // relative: screen-reader-only labels (position: absolute) inside tables must stay clipped by the card.
    <section className={`relative overflow-hidden rounded-lg border border-slate-200 bg-white ${className}`}>
      {title && (
        <header className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {actions}
        </header>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

/** A row of key figures in one panel, split by hairlines. */
export function Stats({ children, className = "" }: { children: ReactNode; className?: string }) {
  const count = Array.isArray(children) ? children.filter(Boolean).length : 1;
  const cols = count >= 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-3";
  return <div className={`grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 ${cols} ${className}`}>{children}</div>;
}

export function Stat({ label, value, hint, tone = "default" }: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn";
}) {
  const hintTone = tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-slate-500";
  return (
    <div className="bg-white px-4 py-3.5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {hint && (
        <p className={`mt-0.5 flex items-center gap-1.5 text-xs ${hintTone}`}>
          {tone !== "default" && <span className={`size-1.5 rounded-full ${tone === "good" ? "bg-emerald-500" : "bg-amber-500"}`} />}
          {hint}
        </p>
      )}
    </div>
  );
}

const DOT = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
  slate: "bg-slate-400",
  blue: "bg-sky-500",
};

export function Badge({ tone = "slate", pulse = false, children }: { tone?: keyof typeof DOT; pulse?: boolean; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-slate-200 bg-white px-1.5 py-px text-xs font-medium text-slate-700">
      <span className={`size-1.5 shrink-0 rounded-full ${DOT[tone]} ${pulse ? "animate-pulse" : ""}`} />
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, keyof typeof DOT> = {
  present: "green", half: "amber", absent: "red", leave: "blue",
  pending: "amber", approved: "green", rejected: "red", needs_review: "amber",
  processing: "blue", unclaimed: "amber", completed: "green", failed: "red",
  active: "green", inactive: "slate",
};
const STATUS_LABEL: Record<string, string> = { half: "Half day", leave: "On leave", needs_review: "Needs review", unclaimed: "Awaiting PayPal sign-up" };

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? "slate"} pulse={status === "processing"}>
      {STATUS_LABEL[status] ?? status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export function Avatar({ name }: { name: string }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
      {initials(name)}
    </span>
  );
}

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "lg" | "md" | "sm";
const BTN: Record<Variant, string> = {
  primary: "bg-teal-700 text-white hover:bg-teal-800 disabled:bg-slate-200 disabled:text-slate-400",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900 disabled:border-slate-200 disabled:text-slate-400",
  danger: "border border-slate-300 bg-white text-rose-700 hover:border-rose-300 hover:bg-rose-50 disabled:border-slate-200 disabled:bg-white disabled:text-slate-400",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:bg-transparent disabled:text-slate-400",
};
const SIZE: Record<Size, string> = { lg: "h-9 px-3.5 text-sm", md: "h-8 px-3 text-sm", sm: "h-7 px-2 text-xs" };

/** Button styling, also for links that look like buttons. `extra` must not repeat height, padding or colors: pick a size instead. */
export function buttonClass(variant: Variant = "secondary", size: Size = "md", extra = "") {
  return `inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed ${SIZE[size]} ${BTN[variant]} ${extra}`;
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };
export function Button({ variant = "secondary", size = "md", className = "", type = "button", ...props }: BtnProps) {
  return <button type={type} {...props} className={buttonClass(variant, size, className)} />;
}

const FIELD =
  "rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 hover:border-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400";

/** Standard full-width text field. */
export const inputClass = `${FIELD} h-8 w-full px-2.5 text-sm`;

/**
 * Field styling with your own height, width, padding and text size. Tailwind can't tell which of two
 * conflicting utilities (say w-full and w-auto) should win, so sizes are passed in, never overridden.
 */
export const fieldClass = (size: string) => `${FIELD} ${size}`;

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

/** On/off toggle. Pass `labelledBy` (or `label`) so screen readers announce what it controls. */
export function Switch({ checked, onChange, label, labelledBy, describedBy, disabled = false }: {
  checked: boolean;
  onChange: (on: boolean) => void;
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-teal-700" : "bg-slate-300"}`}
    >
      <span className={`size-4 rounded-full bg-white shadow-[0_1px_2px_rgba(15,23,42,0.2)] transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
    </button>
  );
}

/** Two-option control (or more), e.g. attendance status or a list filter. */
export function Segmented<T extends string>({ value, options, onChange, label, disabled = false }: {
  value: T | undefined;
  options: { value: T; label: string; dot?: string }[];
  onChange: (v: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-md bg-slate-100 p-0.5">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              on ? "bg-white text-slate-900 shadow-[0_1px_1px_rgba(15,23,42,0.06)] ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {o.dot && <span className={`size-1.5 rounded-full ${on ? o.dot : "bg-slate-300"}`} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const NOTICE = {
  error: { box: "border-rose-200 bg-rose-50 text-rose-900", icon: "text-rose-600", Icon: IconAlert },
  warn: { box: "border-amber-200 bg-amber-50 text-amber-900", icon: "text-amber-600", Icon: IconAlert },
  info: { box: "border-slate-200 bg-white text-slate-700", icon: "text-sky-600", Icon: IconInfo },
  success: { box: "border-slate-200 bg-white text-slate-700", icon: "text-emerald-600", Icon: IconDone },
};

/** Inline message banner. Errors use role="alert"; everything else is a polite status. */
export function Notice({ tone = "info", action, children, className = "" }: {
  tone?: keyof typeof NOTICE;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const t = NOTICE[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm ${t.box} ${className}`}>
      <t.Icon className={`mt-0.5 size-4 shrink-0 ${t.icon}`} />
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="shrink-0 font-medium">{action}</div>}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm text-slate-500">{children}</p>;
}

// Table cells don't wrap: long values truncate or the table scrolls inside its card.
// Cell text color comes from globals.css so a cell can set its own without a class conflict.
const TH = "whitespace-nowrap border-b border-slate-200 bg-slate-50/70 px-4 py-2 text-xs font-medium uppercase tracking-wider text-slate-500";
export const th = `${TH} text-left`;
export const thRight = `${TH} text-right`;
export const td = "whitespace-nowrap px-4 py-2.5 text-sm";
export const linkClass = "font-medium text-teal-700 hover:text-teal-800 hover:underline";
