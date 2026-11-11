import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkerSkeleton } from "@/app/components/Skeleton";
import { Brand } from "@/app/components/icons";
import { SiteFooter } from "@/app/components/SiteFooter";
import { requireRole } from "@/app/lib/auth/dal";
import { getSnapshot } from "@/app/lib/server/service";
import { calculatePay } from "@/app/lib/merchant/incentives";
import { dateRange, formatDate, formatDateTime, formatMoney, formatUsd } from "@/app/lib/merchant/format";
import { Card, EmptyState, Notice, PageHeader, Stat, Stats, StatusBadge, td, th, thRight } from "@/app/components/merchant/ui";
import { signOut } from "@/app/login/actions";

export const metadata: Metadata = { title: "My pay · BolPay" };

const DOT = { present: "bg-emerald-500", half: "bg-amber-500", absent: "bg-rose-500", leave: "bg-sky-500" } as const;
const LEGEND = [
  { label: "Present", dot: DOT.present },
  { label: "Half day", dot: DOT.half },
  { label: "Absent", dot: DOT.absent },
  { label: "Leave", dot: DOT.leave },
  { label: "Not marked", dot: "bg-slate-200" },
];

export default function MyPayPage() {
  return (
    <Suspense fallback={<WorkerSkeleton />}>
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
      <Brand sub={session.business.name} />
      <form action={signOut}>
        <button className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-200/60 hover:text-slate-900">Sign out</button>
      </form>
    </header>
  );

  if (!worker) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-5">
        {header}
        <main className="flex-1">
          <Card><EmptyState>Your login isn&apos;t linked to a worker profile yet. Ask your employer to link it.</EmptyState></Card>
        </main>
        <SiteFooter className="mt-10 border-t border-slate-200 pt-4" />
      </div>
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
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-5 text-slate-900">
      {header}
      <main className="flex-1">
        <PageHeader title={`Hi, ${worker.name.split(" ")[0]}`} description={`${worker.role} · ${worker.city} · Pay period ${period.label}`} />

        <Stats>
          <Stat label="Earned so far" value={formatMoney(pay.total)} hint="This period" />
          <Stat label="Days worked" value={String(pay.payDays)} hint={`of ${pay.periodDays} marked`} />
          <Stat label="Delivery bonus" value={formatMoney(pay.tierBonus + pay.performanceIncentive)} hint={`${pay.extraUnits} extra deliveries`} />
          <Stat label="Paid to date" value={formatMoney(paidTotal)} hint="Through PayPal" />
        </Stats>

        {pending.length > 0 && (
          <Notice tone="info" className="mt-4">
            {formatMoney(pending.reduce((s, p) => s + p.amount, 0))} is waiting for your employer&apos;s approval.
          </Notice>
        )}

        <Card title="This period" className="mt-5">
          <div className="flex flex-wrap gap-1">
            {dateRange(period.start, period.end).map((d) => {
              const r = byDate.get(d);
              return (
                <div key={d} className="flex w-8 flex-col items-center gap-1 text-xs text-slate-500 tabular-nums" title={r ? `${formatDate(d)}: ${r.status}` : formatDate(d)}>
                  <span className={`size-3 rounded-sm ${r ? DOT[r.status] : d > today ? "bg-slate-100" : "bg-slate-200"}`} />
                  {Number(d.slice(8))}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
            {LEGEND.map((l) => <span key={l.label} className="flex items-center gap-1.5"><span className={`size-2.5 rounded-sm ${l.dot}`} />{l.label}</span>)}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-slate-200 pt-4 sm:grid-cols-4">
            <div><dt className="text-xs text-slate-500">Base pay</dt><dd className="mt-0.5 font-medium tabular-nums">{formatMoney(pay.basePay)}</dd></div>
            <div><dt className="text-xs text-slate-500">Overtime</dt><dd className="mt-0.5 font-medium tabular-nums">{formatMoney(pay.overtimePay)}</dd></div>
            <div><dt className="text-xs text-slate-500">Delivery bonus</dt><dd className="mt-0.5 font-medium tabular-nums">{formatMoney(pay.tierBonus + pay.performanceIncentive)}</dd></div>
            <div><dt className="text-xs text-slate-500">Attendance bonus</dt><dd className="mt-0.5 font-medium tabular-nums">{formatMoney(pay.attendanceBonus)}</dd></div>
          </dl>
        </Card>

        <Card title="Payment history" className="mt-5" flush>
          {transactions.length === 0 ? <EmptyState>No payments yet.</EmptyState> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead><tr><th className={th}>Period</th><th className={th}>Date</th><th className={th}>Reference</th><th className={thRight}>Amount</th><th className={th}>Status</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((t) => (
                    <tr key={t.id}>
                      <td className={`${td} whitespace-nowrap`}>{t.periodLabel}</td>
                      <td className={`${td} whitespace-nowrap text-slate-500`}>{formatDateTime(t.createdAt)}</td>
                      <td className={`${td} font-mono text-xs`}>{t.reference && t.reference !== "—" ? t.reference : <span className="font-sans text-slate-400">Not assigned</span>}</td>
                      <td className={`${td} text-right tabular-nums`}>
                        <span className="text-slate-900">{formatMoney(t.amount)}</span>
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
      <SiteFooter className="mt-10 border-t border-slate-200 pt-4" />
    </div>
  );
}
