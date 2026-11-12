"use client";

import { useState } from "react";
import { useStore } from "@/app/lib/merchant/store";
import { formatDateTime, formatMoney, formatUsd } from "@/app/lib/merchant/format";
import type { TransactionStatus } from "@/app/lib/merchant/types";
import { useToast } from "../../feedback/Toaster";
import { Avatar, Button, Card, EmptyState, PageHeader, Segmented, Stat, Stats, StatusBadge, td, th, thRight } from "../ui";

type Filter = "all" | TransactionStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "processing", label: "Processing" },
  { value: "unclaimed", label: "Awaiting sign-up" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

/** The server uses a placeholder until PayPal assigns a reference. */
const hasReference = (ref: string | undefined) => Boolean(ref && ref !== "—" && ref !== "Submitting…");

export function TransactionsView() {
  const { transactions, workerById, retryTransaction, cancelTransaction } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [retrying, setRetrying] = useState<string | null>(null);
  const toast = useToast();

  async function retry(id: string, name: string) {
    setRetrying(id);
    const ok = await retryTransaction(id);
    setRetrying(null);
    if (ok) toast({ tone: "info", title: `Retry sent for ${name}`, description: "PayPal is processing it again." });
  }

  async function cancel(id: string, name: string) {
    if (!window.confirm(`Cancel the payment to ${name} and return the money to your PayPal balance?`)) return;
    setRetrying(id);
    const ok = await cancelTransaction(id);
    setRetrying(null);
    if (ok) toast({ tone: "success", title: `Payment to ${name} cancelled`, description: "The money is back in your PayPal balance." });
  }

  const sum = (s: TransactionStatus) => transactions.filter((t) => t.status === s).reduce((a, t) => a + t.amount, 0);
  const count = (s: TransactionStatus) => transactions.filter((t) => t.status === s).length;
  const shown = [...transactions]
    .filter((t) => filter === "all" || t.status === filter)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <PageHeader title="Transactions" description="Every PayPal transfer, from processing to completion." />

      <Stats className="mb-5">
        <Stat label="Paid out" value={formatMoney(sum("completed"))} hint={`${count("completed")} completed`} tone={count("completed") ? "good" : "default"} />
        <Stat label="In progress" value={formatMoney(sum("processing") + sum("unclaimed"))} hint={count("unclaimed") ? `${count("processing")} processing, ${count("unclaimed")} awaiting sign-up` : `${count("processing")} processing`} tone={count("unclaimed") ? "warn" : "default"} />
        <Stat label="Failed" value={formatMoney(sum("failed"))} hint={count("failed") ? `${count("failed")} need attention` : "None"} tone={count("failed") ? "warn" : "default"} />
      </Stats>

      <Card flush>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2.5">
          <Segmented label="Filter by status" value={filter} options={FILTERS} onChange={setFilter} />
          <span className="ml-auto text-xs text-slate-500 tabular-nums">{shown.length} shown</span>
        </div>
        {shown.length === 0 ? <EmptyState>No transactions to show.</EmptyState> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr>
                  <th className={th}>Worker</th><th className={th}>Reference</th><th className={th}>Period</th><th className={th}>Created</th>
                  <th className={thRight}>Amount</th><th className={th}>Status</th><th className={th}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((t) => {
                  const w = workerById(t.workerId);
                  return (
                    <tr key={t.id}>
                      <td className={td}><div className="flex items-center gap-2.5"><Avatar name={w?.name ?? "?"} /><span className="font-medium text-slate-900">{w?.name ?? "Unknown worker"}</span></div></td>
                      <td className={`${td} font-mono text-xs`}>{hasReference(t.reference) ? t.reference : <span className="font-sans text-slate-400">Not assigned</span>}</td>
                      <td className={`${td} whitespace-nowrap`}>{t.periodLabel}</td>
                      <td className={`${td} whitespace-nowrap text-slate-500`}>{formatDateTime(t.createdAt)}</td>
                      <td className={`${td} text-right tabular-nums`}>
                        <span className="text-slate-900">{formatMoney(t.amount)}</span>
                        {t.usdAmount != null && <span className="block text-xs text-slate-500" title={`Converted at ₹${t.fxRate} per US dollar`}>{formatUsd(t.usdAmount)} via PayPal</span>}
                      </td>
                      <td className={td}>
                        <StatusBadge status={t.status} />
                        {t.failureReason && <p className="mt-1 max-w-[16rem] whitespace-normal text-xs text-rose-700">{t.failureReason}</p>}
                        {t.note && <p className="mt-1 max-w-[15rem] whitespace-normal text-xs text-amber-800">{t.note}</p>}
                      </td>
                      <td className={`${td} text-right`}>
                        {t.status === "unclaimed" && (
                          <Button size="sm" disabled={retrying === t.id} onClick={() => void cancel(t.id, w?.name ?? "this worker")}>
                            {retrying === t.id ? "Cancelling…" : "Cancel and refund"}
                          </Button>
                        )}
                        {t.status === "failed" && (
                          <Button size="sm" disabled={retrying === t.id} onClick={() => void retry(t.id, w?.name ?? "this worker")} title={w?.payoutEmail ? undefined : "Add a PayPal email on the Workers page first"}>
                            {retrying === t.id ? "Retrying…" : "Retry"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
