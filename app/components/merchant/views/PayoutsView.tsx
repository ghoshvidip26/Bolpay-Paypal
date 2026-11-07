"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useStore } from "@/app/lib/merchant/store";
import { formatDateTime, formatMoney } from "@/app/lib/merchant/format";
import { Avatar, Button, Card, EmptyState, PageHeader, StatCard, StatusBadge, td, th } from "../ui";

export function PayoutsView() {
  const { payouts, workerById, approvePayouts, rejectPayouts } = useStore();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const pending = payouts.filter((p) => p.status === "pending");
  const review = payouts.filter((p) => p.status === "needs_review");
  const decided = payouts.filter((p) => p.status === "approved" || p.status === "rejected").sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""));
  const chosen = pending.filter((p) => selected.has(p.id));
  const chosenTotal = chosen.reduce((s, p) => s + p.amount, 0);
  const missingAccount = chosen.filter((p) => !workerById(p.workerId)?.payoutEmail);
  const allSelected = pending.length > 0 && chosen.length === pending.length;

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const act = (kind: "approve" | "reject", ids: string[]) => {
    (kind === "approve" ? approvePayouts : rejectPayouts)(ids);
    setSelected(new Set());
    setConfirming(false);
  };

  return (
    <>
      <PageHeader title="Payout approvals" description="Review each payout, then approve to send it via PayPal." />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Pending" value={String(pending.length)} tone={pending.length ? "warn" : "default"} />
        <StatCard label="Pending amount" value={formatMoney(pending.reduce((s, p) => s + p.amount, 0))} />
        <StatCard label="Selected" value={formatMoney(chosenTotal)} hint={`${chosen.length} payout${chosen.length === 1 ? "" : "s"}`} />
      </div>

      {review.length > 0 && (
        <Card title={`Needs review (${review.length})`} className="mb-6" flush>
          <p className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
            These workers have missing or conflicting records, so they can&apos;t be approved yet. Fix the data on the{" "}
            <Link href="/attendance" className="font-medium underline">Attendance</Link> page, then submit the period again from{" "}
            <Link href="/incentives" className="font-medium underline">Incentives</Link>.
          </p>
          <ul className="divide-y divide-slate-100">
            {review.map((p) => (
              <li key={p.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                <Avatar name={workerById(p.workerId)?.name ?? "?"} />
                <div>
                  <p className="font-medium text-slate-900">{workerById(p.workerId)?.name} <StatusBadge status={p.status} /></p>
                  {p.reviewReasons?.map((r) => <p key={r} className="text-xs text-amber-800">{r}</p>)}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card
        title="Awaiting approval"
        className="mb-6"
        flush
        actions={
          <div className="flex gap-2">
            <Button variant="danger" disabled={!chosen.length} onClick={() => act("reject", chosen.map((p) => p.id))}>Reject selected</Button>
            <Button variant="primary" disabled={!chosen.length} onClick={() => setConfirming(true)}>Approve selected</Button>
          </div>
        }
      >
        {confirming && (
          <div role="alertdialog" aria-label="Confirm payout approval" className="border-b border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            <p className="font-medium">Send {formatMoney(chosenTotal)} to {chosen.length} worker{chosen.length === 1 ? "" : "s"}?</p>
            <p className="mt-1 text-amber-800">This starts the PayPal transfers and can&apos;t be undone from here.</p>
            {missingAccount.length > 0 && (
              <p className="mt-1 font-medium text-rose-700">
                {missingAccount.map((p) => workerById(p.workerId)?.name).join(", ")} {missingAccount.length === 1 ? "has" : "have"} no PayPal account — {missingAccount.length === 1 ? "that payment" : "those payments"} will fail.
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <Button variant="primary" onClick={() => { act("approve", chosen.map((p) => p.id)); }}>Yes, approve</Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
            </div>
          </div>
        )}
        {pending.length === 0 ? (
          <EmptyState>
            Nothing waiting. Submit a period from <Link href="/incentives" className="font-medium text-teal-700 underline">Incentives</Link>.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <th className={th}><input type="checkbox" aria-label="Select all" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(pending.map((p) => p.id)))} /></th>
                  <th className={th}>Worker</th><th className={th}>Period</th><th className={`${th} text-right`}>Amount</th><th className={th} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pending.map((p) => {
                  const w = workerById(p.workerId);
                  const b = p.breakdown;
                  return (
                    <Fragment key={p.id}>
                      <tr>
                        <td className={td}><input type="checkbox" aria-label={`Select ${w?.name}`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} /></td>
                        <td className={td}>
                          <div className="flex items-center gap-3"><Avatar name={w?.name ?? "?"} />
                            <div><p className="font-medium text-slate-900">{w?.name}</p>
                              <p className="text-xs text-slate-500">{w?.payoutEmail || <span className="text-rose-600">No PayPal account</span>}</p></div></div>
                        </td>
                        <td className={td}>{p.periodLabel}</td>
                        <td className={`${td} text-right font-semibold tabular-nums text-slate-900`}>{formatMoney(p.amount)}</td>
                        <td className={`${td} text-right`}>
                          <Button variant="ghost" onClick={() => setOpenId(openId === p.id ? null : p.id)} aria-expanded={openId === p.id}>{openId === p.id ? "Hide" : "Details"}</Button>
                        </td>
                      </tr>
                      {openId === p.id && (
                        <tr className="bg-slate-50">
                          <td />
                          <td colSpan={4} className="px-5 py-3 text-sm text-slate-600">
                            <dl className="grid max-w-md grid-cols-2 gap-x-6 gap-y-1">
                              <dt>Base ({b.payDays} days)</dt><dd className="text-right tabular-nums">{formatMoney(b.basePay)}</dd>
                              <dt>Overtime ({b.overtimeHours}h)</dt><dd className="text-right tabular-nums">{formatMoney(b.overtimePay)}</dd>
                              <dt>Performance ({b.extraUnits} extra units)</dt><dd className="text-right tabular-nums">{formatMoney(b.performanceIncentive)}</dd>
                              <dt>Delivery tiers</dt><dd className="text-right tabular-nums">{formatMoney(b.tierBonus ?? 0)}</dd>
                              <dt>Attendance bonus</dt><dd className="text-right tabular-nums">{formatMoney(b.attendanceBonus)}</dd>
                              <dt>Rules version</dt><dd className="text-right tabular-nums">v{p.ruleVersion ?? 1}</dd>
                            </dl>
                            <div className="mt-3 flex gap-2">
                              <Button variant="primary" onClick={() => act("approve", [p.id])}>Approve</Button>
                              <Button variant="danger" onClick={() => act("reject", [p.id])}>Reject</Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Decision history" flush>
        {decided.length === 0 ? <EmptyState>No decisions yet.</EmptyState> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead><tr><th className={th}>Worker</th><th className={th}>Period</th><th className={`${th} text-right`}>Amount</th><th className={th}>Decision</th><th className={th}>When</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {decided.map((p) => (
                  <tr key={p.id}>
                    <td className={td}>{workerById(p.workerId)?.name}</td>
                    <td className={td}>{p.periodLabel}</td>
                    <td className={`${td} text-right tabular-nums`}>{formatMoney(p.amount)}</td>
                    <td className={td}><StatusBadge status={p.status} /></td>
                    <td className={td}>{p.decidedAt && formatDateTime(p.decidedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
