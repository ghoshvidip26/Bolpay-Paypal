import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/app/lib/auth/dal";
import { BrandMark } from "@/app/components/icons";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in · BolPay" };

/** Already signed in? Go straight to your home page. */
async function RedirectIfSignedIn(): Promise<null> {
  const session = await getSession();
  if (session) redirect(homeFor(session.role));
  return null;
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-4 py-6">
      <main className="w-full max-w-[22rem] rounded-xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-2.5">
          <BrandMark className="size-8" />
          <span className="text-base font-semibold tracking-tight text-slate-900">BolPay</span>
        </div>
        <h1 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">Sign in</h1>
        <p className="mt-0.5 text-sm text-slate-500">Attendance, payroll and PayPal payouts.</p>

        <div className="mt-4">
          <Suspense>
            <RedirectIfSignedIn />
          </Suspense>
          <LoginForm />
        </div>

        <p className="mt-4 border-t border-slate-100 pt-3.5 text-xs text-slate-500">
          Invite-only. Ask your business owner for access.
        </p>
      </main>

      <footer className="flex items-center gap-3 text-xs text-slate-500">
        <span>© 2026 BolPay</span>
        <span aria-hidden className="text-slate-300">·</span>
        <Link href="/terms" className="hover:text-slate-900">Terms</Link>
        <span aria-hidden className="text-slate-300">·</span>
        <Link href="/privacy" className="hover:text-slate-900">Privacy</Link>
      </footer>
    </div>
  );
}
