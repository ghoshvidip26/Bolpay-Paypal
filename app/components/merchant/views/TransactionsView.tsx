"use client";

import { useState } from "react";
import { useStore } from "@/app/lib/merchant/store";
import { formatDateTime, formatMoney } from "@/app/lib/merchant/format";
import type { TransactionStatus } from "@/app/lib/merchant/types";
import { Avatar, Button, Card, EmptyState, PageHeader, StatCard, StatusBadge, td, th } from "../ui";

const FILTERS: ("all" | TransactionStatus)[] = ["all", "processing", "completed", "failed"];

export function TransactionsView() {
  const { transactions, workerById, retryTransaction } = useStore();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  const sum = (s: TransactionStatus) => transactions.filter((t) => t.status === s).reduce((a, t) => a + t.amount, 0);
  const count = (s: TransactionStatus) => transactions.filter((t) => t.status === s).length;
  const shown = [...transactions]
    .filter((t) => filter === "all" || t.status === filter)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <PageHeader title="Transactions" description="Track every PayPal transfer from processing to completion." />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Paid out" value={formatMoney(sum("completed"))} hint={`${count("completed")} completed`} tone="good" />
        <StatCard label="In progress" value={formatMoney(sum("processing"))} hint={`${count("processing")} processing`} />
        <StatCard label="Failed" value={formatMoney(sum("failed"))} hint={`${count("failed")} need attention`} tone={count("failed") ? "warn" : "default"} />
      </div>

      <Card flush>
        <div role="tablist" aria-label="Filter by status" className="flex gap-1 border-b border-slate-100 p-3">
          {FILTERS.map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1 text-sm font-medium capitalize ${filter === f ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-100"}`}>
              {f}
            </button>
          ))}
        </div>
        {shown.length === 0 ? <EmptyState>No transactions to show.</EmptyState> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead><tr><th className={th}>Worker</th><th className={th}>Reference</th><th className={th}>Period</th><th className={th}>Created</th><th className={`${th} text-right`}>Amount</th><th className={th}>Status</th><th className={th} /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((t) => {
                  const w = workerById(t.workerId);
                  return (
                    <tr key={t.id}>
                      <td className={td}><div className="flex items-center gap-3"><Avatar name={w?.name ?? "?"} />{w?.name}</div></td>
                      <td className={`${td} font-mono text-xs`}>{t.reference}</td>
                      <td className={td}>{t.periodLabel}</td>
                      <td className={td}>{formatDateTime(t.createdAt)}</td>
                      <td className={`${td} text-right tabular-nums`}>{formatMoney(t.amount)}</td>
                      <td className={td}>
                        <StatusBadge status={t.status} />
                        {t.failureReason && <p className="mt-1 text-xs text-rose-600">{t.failureReason}</p>}
                      </td>
                      <td className={`${td} text-right`}>
                        {t.status === "failed" && (
                          <Button onClick={() => retryTransaction(t.id)} title={w?.payoutEmail ? undefined : "Add a PayPal email on the Workers page first"}>Retry</Button>
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
