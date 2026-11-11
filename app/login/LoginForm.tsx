"use client";

import { useActionState, useRef } from "react";
import { signIn, type LoginState } from "./actions";

const DEMO_PASSWORD = "BolPayDemo#2026";
const DEMO_ACCOUNTS = [
  { email: "owner@demo.bolpay.app", label: "Owner", hint: "Everything, incl. payouts" },
  { email: "supervisor@demo.bolpay.app", label: "Supervisor", hint: "Marks attendance" },
  { email: "ravi@demo.bolpay.app", label: "Worker (Ravi)", hint: "Own pay only" },
];

const input =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});
  const form = useRef<HTMLFormElement>(null);

  function signInAs(email: string) {
    const f = form.current;
    if (!f) return;
    (f.elements.namedItem("email") as HTMLInputElement).value = email;
    (f.elements.namedItem("password") as HTMLInputElement).value = DEMO_PASSWORD;
    f.requestSubmit();
  }

  return (
    <>
      <form ref={form} action={action} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
          <input name="email" type="email" autoComplete="email" defaultValue={state.email} required className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
          <input name="password" type="password" autoComplete="current-password" required className={input} />
        </label>
        {state.error && (
          <p role="alert" className="text-sm text-rose-600">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:bg-slate-300"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-6 border-t border-slate-100 pt-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">Demo accounts</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.email}
              type="button"
              disabled={pending}
              onClick={() => signInAs(a.email)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-left hover:border-teal-400 hover:bg-teal-50 disabled:opacity-50"
            >
              <span className="block text-sm font-medium text-slate-800">{a.label}</span>
              <span className="block text-xs text-slate-500">{a.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
