"use client";

import { useActionState, useState } from "react";
import { signIn, type LoginState } from "./actions";
import { IconAlert, IconEye, IconEyeOff } from "@/app/components/icons";
import { buttonClass, fieldClass } from "@/app/components/merchant/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-3.5">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          defaultValue={state.email}
          required
          aria-invalid={state.error ? true : undefined}
          className={fieldClass("h-9 w-full px-2.5 text-sm")}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
        <span className="relative block">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            aria-invalid={state.error ? true : undefined}
            className={fieldClass("h-9 w-full pl-2.5 pr-9 text-sm")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-md text-slate-400 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-teal-700"
          >
            {showPassword ? <IconEyeOff className="size-4" /> : <IconEye className="size-4" />}
          </button>
        </span>
      </label>

      {state.error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-rose-700">
          <IconAlert className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={buttonClass("primary", "lg", "w-full")}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
