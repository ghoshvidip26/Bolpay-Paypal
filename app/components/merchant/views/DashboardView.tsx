"use client";

import Link from "next/link";
import { usePeriodPay, usePeriodRecords, useStore } from "@/app/lib/merchant/store";
import { formatDateTime, formatMoney } from "@/app/lib/merchant/format";
import { Avatar, Button, Card, EmptyState, PageHeader, StatCard, StatusBadge, td, th } from "../ui";

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
  const recent = [...transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const top = [...pay].sort((a, b) => b.pay.total - a.pay.total).slice(0, 5);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Pay period ${period.label}`}
        actions={<Link href="/attendance"><Button variant="primary">Mark today&apos;s attendance</Button></Link>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active workers" value={String(active.length)} hint={`${workers.length - active.length} inactive`} />
        <StatCard label="Present today" value={`${present} / ${active.length}`} hint={unmarked > 0 ? `${unmarked} not marked yet` : "All marked"} tone={unmarked > 0 ? "warn" : "good"} />
        <StatCard label="Projected payout" value={formatMoney(projected)} hint="This period, before approval" />
        <StatCard label="Awaiting approval" value={formatMoney(pendingTotal)} hint={`${pending.length} payout${pending.length === 1 ? "" : "s"}`} tone={pending.length ? "warn" : "default"} />
      </div>

      {failed.length > 0 && (
        <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>{failed.length} payment{failed.length === 1 ? "" : "s"} failed and need attention.</span>
          <Link href="/transactions" className="font-medium underline">Review transactions</Link>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Top earners this period" flush>
          <table className="w-full">
            <thead><tr><th className={th}>Worker</th><th className={`${th} text-right`}>Incentives</th><th className={`${th} text-right`}>Total</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {top.map(({ worker, pay: p }) => (
                <tr key={worker.id}>
                  <td className={td}><div className="flex items-center gap-3"><Avatar name={worker.name} />{worker.name}</div></td>
                  <td className={`${td} text-right tabular-nums`}>{formatMoney(p.performanceIncentive + p.attendanceBonus + p.overtimePay)}</td>
                  <td className={`${td} text-right font-medium tabular-nums`}>{formatMoney(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Recent transactions" actions={<Link href="/transactions" className="text-sm font-medium text-teal-700 hover:underline">View all</Link>} flush>
          {recent.length === 0 ? <EmptyState>No transactions yet.</EmptyState> : (
            <ul className="divide-y divide-slate-100">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{workerById(t.workerId)?.name ?? "Unknown"}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(t.createdAt)} · {t.reference}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums">{formatMoney(t.amount)}</span>
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
