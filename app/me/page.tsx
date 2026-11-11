import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/app/components/PageLoading";
import { requireRole } from "@/app/lib/auth/dal";
import { getSnapshot } from "@/app/lib/server/service";
import { calculatePay } from "@/app/lib/merchant/incentives";
import { dateRange, formatDate, formatDateTime, formatMoney, formatUsd } from "@/app/lib/merchant/format";
import { Card, EmptyState, PageHeader, StatCard, StatusBadge, td, th } from "@/app/components/merchant/ui";
import { signOut } from "@/app/login/actions";

export const metadata: Metadata = { title: "My pay · BolPay" };

const DOT = { present: "bg-emerald-500", half: "bg-amber-400", absent: "bg-rose-500", leave: "bg-sky-500" } as const;

export default function MyPayPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <MyPay />
    </Suspense>
  );
}

/** A worker's own view: attendance, earnings so far and payment history (proof of income). */
async function MyPay() {
  const session = await requireRole(["worker"]);
  // Only this worker's records leave the server.
  const snap = getSnapshot();
  const worker = snap.workers.find((w) => w.id === session.workerRef);

  const header = (
    <header className="mb-6 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-teal-600 text-sm font-bold text-white">B</span>
        <div>
          <p className="font-semibold leading-tight">BolPay</p>
          <p className="text-xs text-slate-500">{session.business.name}</p>
        </div>
      </div>
      <form action={signOut}>
        <button className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Sign out</button>
      </form>
    </header>
  );

  if (!worker) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        {header}
        <Card><EmptyState>Your login isn&apos;t linked to a worker profile yet. Ask your employer.</EmptyState></Card>
      </main>
    );
  }

  const { period, today } = snap;
  const current = snap.attendance.filter((r) => r.workerId === worker.id && r.date >= period.start && r.date <= period.end);
  const pay = calculatePay(worker, current, snap.rules);
  const transactions = snap.transactions.filter((t) => t.workerId === worker.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const paidTotal = transactions.filter((t) => t.status === "completed").reduce((s, t) => s + t.amount, 0);
  const pending = snap.payouts.filter((p) => p.workerId === worker.id && (p.status === "pending" || p.status === "needs_review"));
  const byDate = new Map(current.map((r) => [r.date, r]));

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 text-slate-900">
      {header}
      <PageHeader title={`Hi, ${worker.name.split(" ")[0]}`} description={`${worker.role} · ${worker.city} · pay period ${period.label}`} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Earned so far" value={formatMoney(pay.total)} hint="This period" tone="good" />
        <StatCard label="Days worked" value={String(pay.payDays)} hint={`of ${pay.periodDays} marked`} />
        <StatCard label="Delivery bonus" value={formatMoney(pay.tierBonus + pay.performanceIncentive)} hint={`${pay.extraUnits} extra deliveries`} />
        <StatCard label="Paid to date" value={formatMoney(paidTotal)} hint="Via PayPal" />
      </div>

      <Card title="This period" className="mt-6">
        <div className="flex flex-wrap gap-1.5">
          {dateRange(period.start, period.end).map((d) => {
            const r = byDate.get(d);
            return (
              <div key={d} className="flex w-9 flex-col items-center gap-1 text-xs text-slate-500" title={r ? `${formatDate(d)}: ${r.status}` : formatDate(d)}>
                <span className={`size-3 rounded-full ${r ? DOT[r.status] : d > today ? "bg-slate-100" : "bg-slate-200"}`} />
                {Number(d.slice(8))}
              </div>
            );
          })}
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div><dt className="text-slate-500">Base pay</dt><dd className="font-medium tabular-nums">{formatMoney(pay.basePay)}</dd></div>
          <div><dt className="text-slate-500">Overtime</dt><dd className="font-medium tabular-nums">{formatMoney(pay.overtimePay)}</dd></div>
          <div><dt className="text-slate-500">Delivery bonus</dt><dd className="font-medium tabular-nums">{formatMoney(pay.tierBonus + pay.performanceIncentive)}</dd></div>
          <div><dt className="text-slate-500">Attendance bonus</dt><dd className="font-medium tabular-nums">{formatMoney(pay.attendanceBonus)}</dd></div>
        </dl>
        {pending.length > 0 && (
          <p className="mt-4 text-sm text-amber-700">Waiting for approval: {formatMoney(pending.reduce((s, p) => s + p.amount, 0))}</p>
        )}
      </Card>

      <Card title="Payment history" className="mt-6" flush>
        {transactions.length === 0 ? <EmptyState>No payments yet.</EmptyState> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead><tr><th className={th}>Period</th><th className={th}>Date</th><th className={th}>Reference</th><th className={`${th} text-right`}>Amount</th><th className={th}>Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td className={td}>{t.periodLabel}</td>
                    <td className={td}>{formatDateTime(t.createdAt)}</td>
                    <td className={`${td} font-mono text-xs`}>{t.reference}</td>
                    <td className={`${td} text-right tabular-nums`}>
                      {formatMoney(t.amount)}
                      {t.usdAmount !== undefined && <span className="block text-xs text-slate-500">{formatUsd(t.usdAmount)} via PayPal</span>}
                    </td>
                    <td className={td}><StatusBadge status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  );
}
