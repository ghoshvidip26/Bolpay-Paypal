import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/app/lib/auth/dal";
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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-teal-600 text-base font-bold text-white">B</span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">BolPay</h1>
            <p className="text-xs text-slate-500">Speak attendance. Pay your crew.</p>
          </div>
        </div>
        <Suspense>
          <RedirectIfSignedIn />
        </Suspense>
        <LoginForm />
      </div>
    </main>
  );
}
