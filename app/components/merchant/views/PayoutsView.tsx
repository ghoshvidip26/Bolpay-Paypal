"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useStore } from "@/app/lib/merchant/store";
import { formatDateTime, formatMoney } from "@/app/lib/merchant/format";
import { playSound } from "@/app/lib/client/sounds";
import { useToast } from "../../feedback/Toaster";
import { Avatar, Button, Card, EmptyState, linkClass, Notice, PageHeader, Stat, Stats, StatusBadge, td, th, thRight } from "../ui";

export function PayoutsView() {
  const { payouts, workerById, approvePayouts, rejectPayouts } = useStore();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirming, setConfirmingState] = useState(false);
  const [busy, setBusy] = useState(false);

  const setConfirming = (on: boolean) => {
    if (on) playSound("attention"); // money is about to move
    setConfirmingState(on);
  };

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

  const act = async (kind: "approve" | "reject", ids: string[]) => {
    const chosenNow = pending.filter((p) => ids.includes(p.id));
    const total = chosenNow.reduce((s, p) => s + p.amount, 0);
    const n = chosenNow.length;
    setBusy(true);
    const ok = await (kind === "approve" ? approvePayouts : rejectPayouts)(ids);
    setBusy(false);
    setSelected(new Set());
    setConfirmingState(false);
    if (!ok) return; // the store raises the error toast
    if (kind === "approve") {
      toast({
        tone: "success",
        title: `Sent ${n} payout${n === 1 ? "" : "s"} to PayPal`,
        description: `${formatMoney(total)} in total. You'll get a notice as each payment completes.`,
        action: { label: "Track in Transactions", href: "/transactions" },
      });
    } else {
      toast({ tone: "info", sound: false, title: `Rejected ${n} payout${n === 1 ? "" : "s"}`, description: "They can be submitted again from Incentives." });
    }
  };

  return (
    <>
      <PageHeader title="Payout approvals" description="Review each payout, then approve to send it through PayPal." />

      <Stats className="mb-5">
        <Stat label="Pending" value={String(pending.length)} hint={review.length ? `${review.length} need review` : "Ready to decide"} tone={review.length ? "warn" : "default"} />
        <Stat label="Pending amount" value={formatMoney(pending.reduce((s, p) => s + p.amount, 0))} hint="Sent in USD at approval" />
        <Stat label="Selected" value={formatMoney(chosenTotal)} hint={`${chosen.length} payout${chosen.length === 1 ? "" : "s"}`} />
      </Stats>

      {review.length > 0 && (
        <Card title={`Needs review (${review.length})`} className="mb-5" flush>
          <div className="border-b border-slate-200 p-3">
            <Notice tone="warn">
              These workers have missing or conflicting records, so they can&apos;t be approved yet. Fix the data on{" "}
              <Link href="/attendance" className="font-medium underline underline-offset-2">Attendance</Link>, then submit the period again from{" "}
              <Link href="/incentives" className="font-medium underline underline-offset-2">Incentives</Link>.
            </Notice>
          </div>
          <ul className="divide-y divide-slate-100">
            {review.map((p) => (
              <li key={p.id} className="flex items-start gap-2.5 px-4 py-2.5">
                <Avatar name={workerById(p.workerId)?.name ?? "?"} />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                    {workerById(p.workerId)?.name} <StatusBadge status={p.status} />
                  </p>
                  {p.reviewReasons?.map((r) => <p key={r} className="mt-0.5 text-xs text-slate-600">{r}</p>)}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card
        title="Awaiting approval"
        className="mb-5"
        flush
        actions={
          <div className="flex gap-2">
            <Button variant="danger" size="sm" disabled={!chosen.length || busy} onClick={() => void act("reject", chosen.map((p) => p.id))}>Reject selected</Button>
            <Button variant="primary" size="sm" disabled={!chosen.length || busy} onClick={() => setConfirming(true)}>Approve selected</Button>
          </div>
        }
      >
        {confirming && chosen.length > 0 && (
          <div role="alertdialog" aria-label="Confirm payout approval" className="border-b border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-950">
            <p className="font-semibold">Send {formatMoney(chosenTotal)} to {chosen.length} worker{chosen.length === 1 ? "" : "s"}?</p>
            <p className="mt-0.5 text-amber-900">This starts the PayPal transfers and can&apos;t be undone from here.</p>
            {missingAccount.length > 0 && (
              <p className="mt-1.5 font-medium text-rose-700">
                {missingAccount.map((p) => workerById(p.workerId)?.name).join(", ")} {missingAccount.length === 1 ? "has" : "have"} no PayPal account, so{" "}
                {missingAccount.length === 1 ? "that payment" : "those payments"} will fail.
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <Button variant="primary" disabled={busy} onClick={() => void act("approve", chosen.map((p) => p.id))}>{busy ? "Sending…" : "Approve and send"}</Button>
              <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>Cancel</Button>
            </div>
          </div>
        )}
        {pending.length === 0 ? (
          <EmptyState>
            Nothing waiting. Submit a period from <Link href="/incentives" className={linkClass}>Incentives</Link>.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <th className={`${th} w-10`}>
                    <input type="checkbox" className="accent-teal-700" aria-label="Select all" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(pending.map((p) => p.id)))} />
                  </th>
                  <th className={th}>Worker</th>
                  <th className={th}>Period</th>
                  <th className={thRight}>Amount</th>
                  <th className={th}><span className="sr-only">Details</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pending.map((p) => {
                  const w = workerById(p.workerId);
                  const b = p.breakdown;
                  return (
                    <Fragment key={p.id}>
                      <tr className={selected.has(p.id) ? "bg-teal-50/40" : ""}>
                        <td className={td}>
                          <input type="checkbox" className="accent-teal-700" aria-label={`Select ${w?.name}`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                        </td>
                        <td className={td}>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={w?.name ?? "?"} />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900">{w?.name}</p>
                              <p className="truncate text-xs text-slate-500">{w?.payoutEmail || <span className="font-medium text-rose-700">No PayPal account</span>}</p>
                            </div>
                          </div>
                        </td>
                        <td className={`${td} whitespace-nowrap`}>{p.periodLabel}</td>
                        <td className={`${td} text-right font-semibold tabular-nums text-slate-900`}>{formatMoney(p.amount)}</td>
                        <td className={`${td} text-right`}>
                          <Button variant="ghost" size="sm" onClick={() => setOpenId(openId === p.id ? null : p.id)} aria-expanded={openId === p.id}>
                            {openId === p.id ? "Hide" : "Details"}
                          </Button>
                        </td>
                      </tr>
                      {openId === p.id && (
                        <tr className="bg-slate-50/70">
                          <td />
                          <td colSpan={4} className="px-4 py-3 text-sm text-slate-600">
                            <dl className="grid max-w-sm grid-cols-[1fr_auto] gap-x-8 gap-y-1">
                              <dt>Base ({b.payDays} days)</dt><dd className="text-right tabular-nums">{formatMoney(b.basePay)}</dd>
                              <dt>Overtime ({b.overtimeHours}h)</dt><dd className="text-right tabular-nums">{formatMoney(b.overtimePay)}</dd>
                              <dt>Performance ({b.extraUnits} extra units)</dt><dd className="text-right tabular-nums">{formatMoney(b.performanceIncentive)}</dd>
                              <dt>Delivery tiers</dt><dd className="text-right tabular-nums">{formatMoney(b.tierBonus ?? 0)}</dd>
                              <dt>Attendance bonus</dt><dd className="text-right tabular-nums">{formatMoney(b.attendanceBonus)}</dd>
                              <dt className="border-t border-slate-200 pt-1 font-medium text-slate-900">Total</dt>
                              <dd className="border-t border-slate-200 pt-1 text-right font-medium tabular-nums text-slate-900">{formatMoney(p.amount)}</dd>
                            </dl>
                            <p className="mt-2 text-xs text-slate-500">Calculated with rules v{p.ruleVersion ?? 1}.</p>
                            <div className="mt-3 flex gap-2">
                              <Button variant="primary" size="sm" onClick={() => { setSelected(new Set([p.id])); setConfirming(true); }}>Approve</Button>
                              <Button variant="danger" size="sm" disabled={busy} onClick={() => void act("reject", [p.id])}>Reject</Button>
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
              <thead><tr><th className={th}>Worker</th><th className={th}>Period</th><th className={thRight}>Amount</th><th className={th}>Decision</th><th className={th}>When</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {decided.map((p) => (
                  <tr key={p.id}>
                    <td className={`${td} font-medium text-slate-900`}>{workerById(p.workerId)?.name}</td>
                    <td className={`${td} whitespace-nowrap`}>{p.periodLabel}</td>
                    <td className={`${td} text-right tabular-nums`}>{formatMoney(p.amount)}</td>
                    <td className={td}><StatusBadge status={p.status} /></td>
                    <td className={`${td} whitespace-nowrap text-slate-500`}>{p.decidedAt && formatDateTime(p.decidedAt)}</td>
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
