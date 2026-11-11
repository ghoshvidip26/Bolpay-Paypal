"use client";

import { Sidebar } from "./Sidebar";
import { VoiceAssistant } from "./VoiceAssistant";
import { StoreProvider, useStore } from "@/app/lib/merchant/store";
import { signOut } from "@/app/login/actions";
import { ViewerProvider, useViewer, type Viewer } from "./viewer";

const ROLE_LABEL = { owner: "Owner", supervisor: "Supervisor" } as const;

function Frame({ children }: { children: React.ReactNode }) {
  const { payouts, loaded, error, dismissError } = useStore();
  const viewer = useViewer();
  const pending = payouts.filter((p) => p.status === "pending").length;
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 md:grid md:grid-cols-[240px_1fr]">
      <aside className="flex flex-col border-b border-slate-200 bg-white p-3 md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r md:p-4">
        <div className="mb-3 flex items-center gap-2 px-2 md:mb-6">
          <span className="flex size-8 items-center justify-center rounded-lg bg-teal-600 text-sm font-bold text-white">B</span>
          <div className="min-w-0">
            <p className="font-semibold leading-tight tracking-tight">BolPay</p>
            <p className="truncate text-xs text-slate-500">{viewer.businessName}</p>
          </div>
        </div>
        <Sidebar role={viewer.role} pendingCount={pending} />
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 px-2 pt-3 md:mt-auto">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{viewer.displayName}</p>
            <p className="text-xs text-slate-500">{ROLE_LABEL[viewer.role]}</p>
          </div>
          <form action={signOut}>
            <button className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 md:px-8 md:py-8">
        {error && (
          <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <span>{error}</span>
            <button onClick={dismissError} className="font-medium underline">Dismiss</button>
          </div>
        )}
        {!loaded && <p role="status" className="py-20 text-center text-sm text-slate-500">Loading your workspace…</p>}
        {/* Always rendered (so Next can validate the page) but hidden until data arrives, to avoid a flash of empty state. */}
        <div hidden={!loaded}>{children}</div>
      </main>
      <VoiceAssistant />
    </div>
  );
}

export function Shell({ viewer, children }: { viewer: Viewer; children: React.ReactNode }) {
  return (
    <ViewerProvider viewer={viewer}>
      <StoreProvider>
        <Frame>{children}</Frame>
      </StoreProvider>
    </ViewerProvider>
  );
}
