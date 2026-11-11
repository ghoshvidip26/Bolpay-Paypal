"use client";

import Link from "next/link";
import { usePeriodPay, usePeriodRecords, useStore } from "@/app/lib/merchant/store";
import { formatDateTime, formatMoney } from "@/app/lib/merchant/format";
import { Avatar, buttonClass, Card, EmptyState, linkClass, Notice, PageHeader, Stat, Stats, StatusBadge, td, th, thRight } from "../ui";

export function DashboardView() {
  const { workers, today, period, payouts, transactions, workerById } = useStore();
  const records = usePeriodRecords();
  const pay = usePeriodPay();

  const active = workers.filter((w) => w.status === "active");
  const todays = records.filter((r) => r.date === today);
  const present = todays.filter((r) => r.status === "present" || r.status === "half").length;
  const unmarked = active.length - todays.length;
  const projected = pay.reduce((sum, p) => sum + p.pay.total, 0);
  const pending = payouts.filter((p) => p.status === "pending");
  const pendingTotal = pending.reduce((s, p) => s + p.amount, 0);
  const failed = transactions.filter((t) => t.status === "failed");
  const recent = [...transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const top = [...pay].sort((a, b) => b.pay.total - a.pay.total).slice(0, 6);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Pay period ${period.label}`}
        actions={<Link href="/attendance" className={buttonClass("primary")}>Mark today&apos;s attendance</Link>}
      />

      <Stats>
        <Stat label="Active workers" value={String(active.length)} hint={`${workers.length - active.length} inactive`} />
        <Stat label="Present today" value={`${present} / ${active.length}`} hint={unmarked > 0 ? `${unmarked} not marked yet` : "All marked"} tone={unmarked > 0 ? "warn" : "good"} />
        <Stat label="Projected payout" value={formatMoney(projected)} hint="This period, before approval" />
        <Stat label="Awaiting approval" value={formatMoney(pendingTotal)} hint={`${pending.length} payout${pending.length === 1 ? "" : "s"}`} tone={pending.length ? "warn" : "default"} />
      </Stats>

      {failed.length > 0 && (
        <Notice tone="error" className="mt-4" action={<Link href="/transactions" className="underline underline-offset-2">Review</Link>}>
          {failed.length} payment{failed.length === 1 ? "" : "s"} failed and need{failed.length === 1 ? "s" : ""} attention.
        </Notice>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Top earners this period" flush>
          {top.length === 0 ? <EmptyState>No pay calculated yet.</EmptyState> : (
            <table className="w-full">
              <thead><tr><th className={th}>Worker</th><th className={thRight}>Incentives</th><th className={thRight}>Total</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {top.map(({ worker, pay: p }) => (
                  <tr key={worker.id}>
                    <td className={td}><div className="flex items-center gap-2.5"><Avatar name={worker.name} /><span className="font-medium text-slate-900">{worker.name}</span></div></td>
                    <td className={`${td} text-right tabular-nums`}>{formatMoney(p.performanceIncentive + (p.tierBonus ?? 0) + p.attendanceBonus + p.overtimePay)}</td>
                    <td className={`${td} text-right font-medium tabular-nums text-slate-900`}>{formatMoney(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Recent transactions" actions={<Link href="/transactions" className={`text-xs ${linkClass}`}>View all</Link>} flush>
          {recent.length === 0 ? <EmptyState>No transactions yet.</EmptyState> : (
            <ul className="divide-y divide-slate-100">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{workerById(t.workerId)?.name ?? "Unknown worker"}</p>
                    <p className="truncate text-xs text-slate-500">{formatDateTime(t.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm tabular-nums text-slate-900">{formatMoney(t.amount)}</span>
                    <StatusBadge status={t.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
