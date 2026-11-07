"use client";

import { useState } from "react";
import Link from "next/link";
import { usePeriodPay, useStore } from "@/app/lib/merchant/store";
import { formatMoney } from "@/app/lib/merchant/format";
import type { DeliveryTier, IncentiveRules } from "@/app/lib/merchant/types";
import { Avatar, Badge, Button, Card, Field, inputClass, PageHeader, StatCard, td, th } from "../ui";

export function IncentivesView() {
  const { rules, setRules, period, payouts, submitPeriodForApproval } = useStore();
  const rows = usePeriodPay();
  const [draft, setDraft] = useState<Record<keyof IncentiveRules, string>>(
    () => Object.fromEntries(Object.entries(rules).map(([k, v]) => [k, String(v)])) as Record<keyof IncentiveRules, string>,
  );
  const [notice, setNotice] = useState<string | null>(null);
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
          <Button variant="primary" disabled={toSubmit === 0} onClick={async () => {
            const r = await submitPeriodForApproval();
            const parts = [];
            if (r.created > 0) parts.push(`${r.created} payout${r.created === 1 ? "" : "s"} submitted for approval`);
            if (r.needsReview > 0) parts.push(`${r.needsReview} flagged Needs Review (missing or conflicting records)`);
            if (parts.length) setNotice(`${parts.join("; ")}.`);
          }}>
            Submit {toSubmit} for approval
          </Button>
        }
      />

      {notice && (
        <div role="status" className="mb-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
          <Link href="/payouts" className="font-medium underline">Go to approvals</Link>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Base pay" value={formatMoney(totals.base)} />
        <StatCard label="Overtime + incentives" value={formatMoney(totals.incentives)} tone="good" />
        <StatCard label="Total payout" value={formatMoney(totals.total)} />
      </div>

      <Card title="Payout summary" className="mb-6" flush>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px]">
            <thead>
              <tr>
                <th className={th}>Worker</th>
                <th className={`${th} text-right`}>Days paid</th>
                <th className={`${th} text-right`}>Base</th>
                <th className={`${th} text-right`}>Overtime</th>
                <th className={`${th} text-right`}>Performance</th>
                <th className={`${th} text-right`}>Delivery tiers</th>
                <th className={`${th} text-right`}>Attendance bonus</th>
                <th className={`${th} text-right`}>Total</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ worker, pay }) => (
                <tr key={worker.id}>
                  <td className={td}><div className="flex items-center gap-3"><Avatar name={worker.name} /><div><p className="font-medium text-slate-900">{worker.name}</p><p className="text-xs text-slate-500">{Math.round(pay.attendanceRate * 100)}% attendance</p></div></div></td>
                  <td className={`${td} text-right tabular-nums`}>{pay.payDays} / {pay.periodDays}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatMoney(pay.basePay)}</td>
                  <td className={`${td} text-right tabular-nums`} title={`${pay.overtimeHours}h overtime`}>{formatMoney(pay.overtimePay)}</td>
                  <td className={`${td} text-right tabular-nums`} title={`${pay.extraUnits} units above target`}>{formatMoney(pay.performanceIncentive)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatMoney(pay.tierBonus ?? 0)}</td>
                  <td className={`${td} text-right tabular-nums`}>{pay.attendanceBonus ? formatMoney(pay.attendanceBonus) : "—"}</td>
                  <td className={`${td} text-right font-semibold tabular-nums text-slate-900`}>{formatMoney(pay.total)}</td>
                  <td className={td}>{submitted.has(worker.id) ? <Badge tone="blue">Submitted</Badge> : stateOf(worker.id) === "rejected" ? <Badge tone="red">Rejected · can resubmit</Badge> : stateOf(worker.id) === "needs_review" ? <Badge tone="amber">Needs review</Badge> : <Badge>Draft</Badge>}</td>
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
            <Button variant="ghost" disabled={!dirty} onClick={() => { setDraft(Object.fromEntries(Object.entries(rules).map(([k, v]) => [k, String(v)])) as Record<keyof IncentiveRules, string>); setTiers(rules.deliveryTiers); }}>Reset</Button>
            <Button variant="primary" disabled={!dirty || !valid} onClick={() => setRules({ ...(Object.fromEntries(NUM_KEYS.map((k) => [k, Number(draft[k])])) as unknown as IncentiveRules), deliveryTiers: tiers, version: rules.version })}>Apply</Button>
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
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-slate-700">Daily delivery tiers <span className="font-normal text-slate-500">(highest tier reached each day is paid once)</span></p>
          <div className="space-y-2">
            {tiers.map((t, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <span>At least</span>
                <input aria-label={`Tier ${i + 1} deliveries`} className={`${inputClass} w-20`} type="number" min="1" value={t.minUnits} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, minUnits: Number(e.target.value) } : x)))} />
                <span>deliveries →  ₹</span>
                <input aria-label={`Tier ${i + 1} bonus`} className={`${inputClass} w-24`} type="number" min="0" value={t.bonus} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, bonus: Number(e.target.value) } : x)))} />
                <Button variant="ghost" onClick={() => setTiers(tiers.filter((_, j) => j !== i))}>Remove</Button>
              </div>
            ))}
            <Button variant="ghost" onClick={() => setTiers([...tiers, { minUnits: (tiers.at(-1)?.minUnits ?? 0) + 10, bonus: 0 }])}>Add tier</Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Rules version v{rules.version}. Every payout stores the version it was calculated with.</p>
        </div>
        <p className="mt-4 text-xs text-slate-500">Rule changes recalculate the table above immediately. Payouts already submitted keep the amounts they were submitted with.</p>
      </Card>
    </>
  );
}
