import "server-only";
import { formatDate, formatMoney } from "@/app/lib/merchant/format";
import { calculatePay } from "@/app/lib/merchant/incentives";
import { CURRENT_PERIOD, TODAY } from "@/app/lib/merchant/mock-data";
import { getDb } from "@/app/lib/server/db";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const some = (names: string[], max = 6) => (names.length <= max ? names.join(", ") : `${names.slice(0, max).join(", ")} and ${names.length - max} more`);

/**
 * Read-only answers computed from stored records. Everything here is deterministic: the model only
 * picks which question is being asked.
 */
export function answerQuery(kind: string, o: { workerIds: string[] | null; date: string; n: number | null }): string {
  const db = getDb();
  const nameOf = (id: string) => db.workers.find((w) => w.id === id)?.name ?? "Unknown";
  const txs = db.transactions.filter((t) => t.periodLabel === CURRENT_PERIOD.label);
  const payouts = db.payouts.filter((p) => p.periodId === CURRENT_PERIOD.id);
  const active = db.workers.filter((w) => w.status === "active");
  const records = db.attendance.filter((r) => r.date >= CURRENT_PERIOD.start && r.date <= CURRENT_PERIOD.end);
  const pay = (id: string) => {
    const w = db.workers.find((x) => x.id === id)!;
    return calculatePay(w, records, db.rules).total;
  };
  const by = (s: string) => txs.filter((t) => t.status === s);
  const pending = payouts.filter((p) => p.status === "pending");
  const review = payouts.filter((p) => p.status === "needs_review");
  const dateLabel = o.date === TODAY ? "today" : formatDate(o.date);

  switch (kind) {
    case "payout_summary": {
      if (txs.length === 0 && pending.length === 0 && review.length === 0) return "There are no payouts for this period yet.";
      const parts = [`${by("completed").length} completed`, `${by("processing").length} processing`, `${by("failed").length} failed`];
      const extra = [pending.length ? `${pending.length} awaiting approval` : "", review.length ? `${review.length} need review` : ""].filter(Boolean);
      return `This period: ${parts.join(", ")}${extra.length ? `, and ${extra.join(" and ")}` : ""}.`;
    }
    case "failed_payments": {
      const f = by("failed");
      return f.length ? `${plural(f.length, "payment")} failed: ${some(f.map((t) => `${nameOf(t.workerId)} (${t.failureReason ?? "unknown reason"})`), 4)}.` : "No payments have failed.";
    }
    case "completed_payments":
      return `${plural(by("completed").length, "payment")} completed.`;
    case "processing_payments": {
      const p = by("processing");
      return p.length ? `${plural(p.length, "payment")} still processing: ${some(p.map((t) => nameOf(t.workerId)))}.` : "Nothing is processing.";
    }
    case "pending_payouts": {
      const proc = by("processing");
      if (!pending.length && !proc.length) return "Nothing is pending.";
      const sum = pending.reduce((s, p) => s + p.amount, 0);
      return `${plural(pending.length, "payout")} awaiting your approval (${formatMoney(sum)})${pending.length ? `: ${some(pending.map((p) => nameOf(p.workerId)))}` : ""}; ${proc.length} processing.`;
    }
    case "needs_review":
      return review.length
        ? `${plural(review.length, "worker")} need review: ${some(review.map((p) => `${nameOf(p.workerId)} (${p.reviewReasons?.[0] ?? "records need checking"})`), 3)}.`
        : "No payouts are flagged for review.";
    case "missing_attendance": {
      const ids = new Set(db.attendance.filter((r) => r.date === o.date).map((r) => r.workerId));
      const missing = active.filter((w) => !ids.has(w.id) && (!o.workerIds || o.workerIds.includes(w.id)));
      return missing.length ? `${plural(missing.length, "worker")} with no attendance ${dateLabel}: ${some(missing.map((w) => w.name))}.` : `Everyone has attendance recorded ${dateLabel}.`;
    }
    case "attendance_summary": {
      const day = db.attendance.filter((r) => r.date === o.date && active.some((w) => w.id === r.workerId));
      const c = (s: string) => day.filter((r) => r.status === s).length;
      const unmarked = active.length - day.length;
      return `${dateLabel}: ${c("present")} present, ${c("half")} half day, ${c("absent")} absent, ${c("leave")} on leave, ${unmarked} not marked.`;
    }
    case "worker_pay": {
      const ids = (o.workerIds ?? []).slice(0, 3);
      if (!ids.length) return "Which worker's pay do you want?";
      return ids.map((id) => `${nameOf(id)}: ${formatMoney(pay(id))} so far this period`).join("; ") + ".";
    }
    case "totals": {
      const total = active.reduce((s, w) => s + pay(w.id), 0);
      const waiting = pending.reduce((s, p) => s + p.amount, 0);
      return `Calculated payout for the period is ${formatMoney(total)} across ${plural(active.length, "worker")}. ${formatMoney(waiting)} is waiting for approval.`;
    }
    case "top_earners": {
      const n = Math.min(Math.max(Math.round(o.n ?? 3), 1), 10);
      const ranked = active.map((w) => ({ name: w.name, total: pay(w.id) })).sort((a, b) => b.total - a.total).slice(0, n);
      return `Top ${n}: ${ranked.map((r) => `${r.name} ${formatMoney(r.total)}`).join(", ")}.`;
    }
    case "worker_list": {
      const list = o.workerIds ? active.filter((w) => o.workerIds!.includes(w.id)) : active;
      return `${plural(list.length, "active worker")}: ${some(list.map((w) => w.name), 10)}.`;
    }
    case "rules_summary": {
      const r = db.rules;
      const tiers = r.deliveryTiers.map((t) => `${t.minUnits}+ deliveries ₹${t.bonus}`).join(", ") || "none";
      return `Rules v${r.version}: daily tiers ${tiers}; overtime ${r.overtimeMultiplier} times hourly; attendance bonus ₹${r.attendanceBonus} at ${Math.round(r.attendanceThreshold * 100)} percent; ₹${r.ratePerExtraUnit} per delivery above ${r.dailyUnitTarget} a day.`;
    }
    default:
      return "I can't answer that yet.";
  }
}
