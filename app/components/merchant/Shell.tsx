"use client";

import { Sidebar } from "./Sidebar";
import { VoiceAssistant } from "./VoiceAssistant";
import { StoreProvider, useStore } from "@/app/lib/merchant/store";

function Frame({ children }: { children: React.ReactNode }) {
  const { payouts } = useStore();
  const pending = payouts.filter((p) => p.status === "pending").length;
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-slate-200 bg-white p-3 md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r md:p-4">
        <div className="mb-3 flex items-center gap-2 px-2 md:mb-6">
          <span className="flex size-8 items-center justify-center rounded-lg bg-teal-600 text-sm font-bold text-white">P</span>
          <span className="font-semibold tracking-tight">PayCrew</span>
        </div>
        <Sidebar pendingCount={pending} />
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 md:px-8 md:py-8">{children}</main>
      <VoiceAssistant />
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <Frame>{children}</Frame>
    </StoreProvider>
  );
}
