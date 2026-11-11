"use client";

import { useEffect, useRef } from "react";
import { Sidebar } from "./Sidebar";
import { AccountMenu } from "./AccountMenu";
import { VoiceAssistant } from "./VoiceAssistant";
import { StoreProvider, useStore } from "@/app/lib/merchant/store";
import { formatMoney } from "@/app/lib/merchant/format";
import { readPreferences } from "@/app/lib/client/preferences";
import { personName, ViewerProvider, useViewer, type Viewer } from "./viewer";
import { Brand } from "../icons";
import { ContentSkeleton } from "../Skeleton";
import { ToastProvider, useToast } from "../feedback/Toaster";

const ROLE_LABEL = { owner: "Owner", supervisor: "Supervisor" } as const;


/** Save errors from the store show up as toasts. */
function useErrorToasts() {
  const { error, dismissError } = useStore();
  const toast = useToast();
  useEffect(() => {
    if (!error) return;
    toast({ tone: "error", title: error });
    dismissError();
  }, [error, dismissError, toast]);
}

/** Announces PayPal payments that complete or fail, whether from polling, an approval or a voice flow. */
function usePaymentAlerts() {
  const { transactions, loaded, workerById } = useStore();
  const toast = useToast();
  const seen = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    if (!loaded) return;
    const prev = seen.current;
    seen.current = new Map(transactions.map((t) => [t.id, t.status]));
    if (!prev || !readPreferences().paymentAlerts) return;

    const completed = transactions.filter((t) => t.status === "completed" && prev.get(t.id) !== "completed");
    const failed = transactions.filter((t) => t.status === "failed" && prev.get(t.id) !== "failed");
    const name = (id: string) => workerById(id)?.name ?? "a worker";

    if (completed.length === 1) {
      const t = completed[0];
      toast({ tone: "success", sound: "payment", title: "Payment completed", description: `${name(t.workerId)} received ${formatMoney(t.amount)}.` });
    } else if (completed.length > 1) {
      const total = completed.reduce((s, t) => s + t.amount, 0);
      toast({ tone: "success", sound: "payment", title: `${completed.length} payments completed`, description: `${formatMoney(total)} paid out through PayPal.` });
    }
    if (failed.length) {
      toast({
        tone: "error",
        title: failed.length === 1 ? `Payment to ${name(failed[0].workerId)} failed` : `${failed.length} payments failed`,
        description: failed.length === 1 ? failed[0].failureReason : "Open Transactions to see why and retry.",
        action: { label: "Review transactions", href: "/transactions" },
      });
    }
  }, [transactions, loaded, workerById, toast]);
}

function Frame({ children }: { children: React.ReactNode }) {
  const { payouts, loaded } = useStore();
  const viewer = useViewer();
  const pending = payouts.filter((p) => p.status === "pending").length;
  useErrorToasts();
  usePaymentAlerts();

  const name = personName(viewer.displayName);
  const role = ROLE_LABEL[viewer.role];

  return (
    // minmax(0, 1fr): a wide table must scroll inside its card, never widen the page.
    <div className="min-h-dvh bg-canvas text-slate-900 md:grid md:grid-cols-[216px_minmax(0,1fr)]">
      <aside className="flex flex-col border-b border-slate-200 bg-white md:sticky md:top-0 md:h-dvh md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3 md:py-4">
          <Brand sub={viewer.businessName} />
          <div className="md:hidden">
            <AccountMenu name={name} role={role} compact />
          </div>
        </div>
        <div className="min-h-0 px-2 pb-2 md:flex-1 md:overflow-y-auto md:px-3">
          <Sidebar role={viewer.role} pendingCount={pending} />
        </div>
        <div className="hidden border-t border-slate-200 p-2 md:block">
          <AccountMenu name={name} role={role} />
        </div>
      </aside>
      <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-5 pb-28 md:px-8 md:py-7">
        {!loaded && <ContentSkeleton />}
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
      <ToastProvider>
        <StoreProvider>
          <Frame>{children}</Frame>
        </StoreProvider>
      </ToastProvider>
    </ViewerProvider>
  );
}
