"use client";

import { useState } from "react";
import { usePeriodPay, useStore } from "@/app/lib/merchant/store";
import { formatMoney } from "@/app/lib/merchant/format";
import type { DeliveryTier, IncentiveRules } from "@/app/lib/merchant/types";
import { useToast } from "../../feedback/Toaster";
import { Avatar, Badge, Button, Card, Field, fieldClass, inputClass, PageHeader, Stat, Stats, td, th, thRight } from "../ui";

export function IncentivesView() {
  const { rules, setRules, period, payouts, submitPeriodForApproval } = useStore();
  const rows = usePeriodPay();
  const toast = useToast();
  const [draft, setDraft] = useState<Record<keyof IncentiveRules, string>>(
    () => Object.fromEntries(Object.entries(rules).map(([k, v]) => [k, String(v)])) as Record<keyof IncentiveRules, string>,
  );
  const [submitting, setSubmitting] = useState(false);
  const [tiers, setTiers] = useState<DeliveryTier[]>(rules.deliveryTiers);
  const tiersDirty = JSON.stringify(tiers) !== JSON.stringify(rules.deliveryTiers);

  const NUM_KEYS = ["workingHoursPerDay", "overtimeMultiplier", "dailyUnitTarget", "ratePerExtraUnit", "attendanceThreshold", "attendanceBonus"] as const;
  const dirty = NUM_KEYS.some((k) => Number(draft[k]) !== rules[k]) || tiersDirty;
  const valid = NUM_KEYS.every((k) => draft[k] !== "" && Number(draft[k]) >= 0) && tiers.every((t) => t.minUnits >= 1 && t.bonus >= 0);

  // Pending and approved payouts block a new submission; rejected and needs-review ones can be submitted again.
  const submitted = new Set(payouts.filter((p) => p.periodId === period.id && (p.status === "pending" || p.status === "approved")).map((p) => p.workerId));
  const stateOf = (workerId: string) => payouts.filter((p) => p.periodId === period.id && p.workerId === workerId).at(-1)?.status;
  const totals = rows.reduce(
    (t, { pay }) => ({
      base: t.base + pay.basePay,
      incentives: t.incentives + pay.overtimePay + pay.performanceIncentive + (pay.tierBonus ?? 0) + pay.attendanceBonus,
      total: t.total + pay.total,
    }),
    { base: 0, incentives: 0, total: 0 },
  );
  const toSubmit = rows.filter(({ worker, pay }) => !submitted.has(worker.id) && pay.total > 0).length;

  const field = (key: keyof IncentiveRules, label: string, step = "1") => (
    <Field label={label}>
      <input className={inputClass} type="number" min="0" step={step} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
    </Field>
  );

  return (
    <>
      <PageHeader
        title="Incentives & payout summary"
        description={`Calculated live from attendance for ${period.label}.`}
        actions={
          <Button variant="primary" disabled={toSubmit === 0 || submitting} onClick={async () => {
            setSubmitting(true);
            const r = await submitPeriodForApproval();
            setSubmitting(false);
            if (r.created === 0 && r.needsReview === 0) return;
            const review = r.needsReview > 0 ? `${r.needsReview} flagged for review because of missing or conflicting records.` : undefined;
            toast({
              tone: r.needsReview > 0 ? "warn" : "success",
              title: r.created > 0 ? `${r.created} payout${r.created === 1 ? "" : "s"} sent for approval` : "Nothing new to approve",
              description: review,
              action: { label: "Go to approvals", href: "/payouts" },
            });
          }}>
            {submitting ? "Submitting…" : `Submit ${toSubmit} for approval`}
          </Button>
        }
      />

      <Stats className="mb-5">
        <Stat label="Base pay" value={formatMoney(totals.base)} hint={`${rows.length} worker${rows.length === 1 ? "" : "s"}`} />
        <Stat label="Overtime and incentives" value={formatMoney(totals.incentives)} hint={totals.total ? `${Math.round((totals.incentives / totals.total) * 100)}% of total` : undefined} />
        <Stat label="Total payout" value={formatMoney(totals.total)} hint={period.label} />
      </Stats>

      <Card title="Payout summary" className="mb-5" flush>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px]">
            <thead>
              <tr>
                <th className={th}>Worker</th>
                <th className={thRight}>Days paid</th>
                <th className={thRight}>Base</th>
                <th className={thRight}>Overtime</th>
                <th className={thRight}>Performance</th>
                <th className={thRight}>Delivery tiers</th>
                <th className={thRight}>Attendance bonus</th>
                <th className={thRight}>Total</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ worker, pay }) => (
                <tr key={worker.id}>
                  <td className={td}><div className="flex items-center gap-2.5"><Avatar name={worker.name} /><div><p className="font-medium text-slate-900">{worker.name}</p><p className="text-xs text-slate-500">{Math.round(pay.attendanceRate * 100)}% attendance</p></div></div></td>
                  <td className={`${td} text-right tabular-nums`}>{pay.payDays} / {pay.periodDays}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatMoney(pay.basePay)}</td>
                  <td className={`${td} text-right tabular-nums`} title={`${pay.overtimeHours}h overtime`}>{formatMoney(pay.overtimePay)}</td>
                  <td className={`${td} text-right tabular-nums`} title={`${pay.extraUnits} units above target`}>{formatMoney(pay.performanceIncentive)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatMoney(pay.tierBonus ?? 0)}</td>
                  <td className={`${td} text-right tabular-nums`}>{pay.attendanceBonus ? formatMoney(pay.attendanceBonus) : <span className="text-slate-400">{formatMoney(0)}</span>}</td>
                  <td className={`${td} text-right font-semibold tabular-nums text-slate-900`}>{formatMoney(pay.total)}</td>
                  <td className={td}>{submitted.has(worker.id) ? <Badge tone="blue">Submitted</Badge> : stateOf(worker.id) === "rejected" ? <Badge tone="red">Rejected, can resubmit</Badge> : stateOf(worker.id) === "needs_review" ? <Badge tone="amber">Needs review</Badge> : <Badge>Draft</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="Incentive rules"
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" disabled={!dirty} onClick={() => { setDraft(Object.fromEntries(Object.entries(rules).map(([k, v]) => [k, String(v)])) as Record<keyof IncentiveRules, string>); setTiers(rules.deliveryTiers); }}>Reset</Button>
            <Button variant="primary" size="sm" disabled={!dirty || !valid} onClick={() => {
              setRules({ ...(Object.fromEntries(NUM_KEYS.map((k) => [k, Number(draft[k])])) as unknown as IncentiveRules), deliveryTiers: tiers, version: rules.version });
              toast({ tone: "success", title: "Incentive rules applied", description: "The payout summary has been recalculated." });
            }}>Apply</Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field("workingHoursPerDay", "Working hours per day")}
          {field("overtimeMultiplier", "Overtime multiplier (×hourly)", "0.1")}
          {field("dailyUnitTarget", "Daily unit target")}
          {field("ratePerExtraUnit", "Incentive per unit above target (₹)", "0.05")}
          {field("attendanceThreshold", "Attendance bonus threshold (0–1)", "0.01")}
          {field("attendanceBonus", "Attendance bonus (₹)")}
        </div>
        <div className="mt-5 border-t border-slate-200 pt-4">
          <p className="text-sm font-medium text-slate-700">Daily delivery tiers</p>
          <p className="mb-3 text-xs text-slate-500">The highest tier a worker reaches each day is paid once.</p>
          <div className="space-y-2">
            {tiers.map((t, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span className="w-14 text-xs font-medium text-slate-500">Tier {i + 1}</span>
                <span>At least</span>
                <input aria-label={`Tier ${i + 1} deliveries`} className={fieldClass("h-7 w-20 px-2 text-sm tabular-nums")} type="number" min="1" value={t.minUnits} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, minUnits: Number(e.target.value) } : x)))} />
                <span>deliveries pays ₹</span>
                <input aria-label={`Tier ${i + 1} bonus`} className={fieldClass("h-7 w-24 px-2 text-sm tabular-nums")} type="number" min="0" value={t.bonus} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, bonus: Number(e.target.value) } : x)))} />
                <Button variant="ghost" size="sm" onClick={() => setTiers(tiers.filter((_, j) => j !== i))}>Remove</Button>
              </div>
            ))}
            <Button size="sm" onClick={() => setTiers([...tiers, { minUnits: (tiers.at(-1)?.minUnits ?? 0) + 10, bonus: 0 }])}>Add tier</Button>
          </div>
        </div>
        <p className="mt-5 border-t border-slate-200 pt-3 text-xs text-slate-500">
          Rules version v{rules.version}. Changes recalculate the summary above immediately. Payouts already submitted keep the amounts and rules version they were submitted with.
        </p>
      </Card>
    </>
  );
}
