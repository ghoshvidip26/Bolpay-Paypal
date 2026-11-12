"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useStore } from "@/app/lib/merchant/store";
import { dateRange, formatDate } from "@/app/lib/merchant/format";
import type { AttendanceStatus } from "@/app/lib/merchant/types";
import { useToast } from "../../feedback/Toaster";
import { Avatar, Button, Card, EmptyState, fieldClass, PageHeader, Segmented, td, th } from "../ui";

// AG Grid is ~335 kB gzipped and the history sits below the fold, so load it after the daily editor.
const AttendanceHistory = dynamic(() => import("../AttendanceHistory").then((m) => m.AttendanceHistory), {
  ssr: false,
  loading: () => (
    <Card className="mt-5" title="Attendance history">
      <div role="status" aria-busy="true" aria-label="Loading attendance history" className="space-y-2">
        {[0, 1, 2, 3].map((i) => <span key={i} className="block h-6 animate-pulse rounded bg-slate-200/80" />)}
      </div>
    </Card>
  ),
});

const DOT: Record<AttendanceStatus, string> = { present: "bg-emerald-500", half: "bg-amber-500", absent: "bg-rose-500", leave: "bg-sky-500" };
const OPTIONS: { value: AttendanceStatus; label: string; dot: string }[] = [
  { value: "present", label: "Present", dot: DOT.present },
  { value: "half", label: "Half", dot: DOT.half },
  { value: "absent", label: "Absent", dot: DOT.absent },
  { value: "leave", label: "Leave", dot: DOT.leave },
];

export function AttendanceView() {
  const { workers, attendance, period, today, markStatus, setAttendance } = useStore();
  const [date, setDate] = useState(today);
  const dates = useMemo(() => dateRange(period.start, period.end), [period]);
  const active = workers.filter((w) => w.status === "active");
  const day = attendance.filter((r) => r.date === date);
  const byWorker = new Map(day.map((r) => [r.workerId, r]));
  const unmarked = active.filter((w) => !byWorker.has(w.id));
  const isFuture = date > today;
  const byKey = useMemo(() => new Map(attendance.map((a) => [`${a.workerId}|${a.date}`, a])), [attendance]);
  const toast = useToast();

  function markRemainingPresent() {
    unmarked.forEach((w) => markStatus(w.id, date, "present"));
    toast({ tone: "success", title: `Marked ${unmarked.length} worker${unmarked.length === 1 ? "" : "s"} present`, description: formatDate(date) });
  }

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Mark who showed up, overtime hours and units completed."
        actions={
          <Button onClick={markRemainingPresent} disabled={isFuture || unmarked.length === 0}>
            Mark remaining present ({unmarked.length})
          </Button>
        }
      />

      <Card
        title={
          <span className="flex items-baseline gap-2">
            {formatDate(date)}
            {date === today && <span className="text-xs font-normal text-slate-500">Today</span>}
            {unmarked.length > 0 && !isFuture && <span className="text-xs font-normal text-amber-700">{unmarked.length} not marked</span>}
          </span>
        }
        className="mb-5"
        actions={<input type="date" aria-label="Attendance date" className={fieldClass("h-7 w-auto px-2 text-xs")} min={period.start} max={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />}
        flush
      >
        {active.length === 0 ? <EmptyState>No active workers.</EmptyState> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead><tr><th className={th}>Worker</th><th className={th}>Status</th><th className={th}>Overtime (h)</th><th className={th}>Units done</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {active.map((w) => {
                  const rec = byWorker.get(w.id);
                  const worked = rec?.status === "present" || rec?.status === "half";
                  return (
                    <tr key={w.id}>
                      <td className={td}><div className="flex items-center gap-2.5"><Avatar name={w.name} /><div><p className="font-medium text-slate-900">{w.name}</p><p className="text-xs text-slate-500">{w.role}</p></div></div></td>
                      <td className={td}>
                        <div className="flex items-center gap-2">
                          <Segmented label={`Attendance for ${w.name}`} value={rec?.status} options={OPTIONS} disabled={isFuture} onChange={(v) => markStatus(w.id, date, v)} />
                          {!rec && <span className="text-xs text-amber-700">Not marked</span>}
                        </div>
                      </td>
                      <td className={td}>
                        <input type="number" min="0" max="12" step="0.5" disabled={!worked} aria-label={`Overtime hours for ${w.name}`} className={fieldClass("h-7 w-20 px-2 text-sm tabular-nums")}
                          value={rec?.overtimeHours ?? 0} onChange={(e) => setAttendance(w.id, date, { overtimeHours: Math.max(0, Number(e.target.value)) })} />
                      </td>
                      <td className={td}>
                        <input type="number" min="0" step="1" disabled={!worked} aria-label={`Units completed by ${w.name}`} className={fieldClass("h-7 w-24 px-2 text-sm tabular-nums")}
                          value={rec?.units ?? 0} onChange={(e) => setAttendance(w.id, date, { units: Math.max(0, Number(e.target.value)) })} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Period overview" flush>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Worker</th>
                {dates.map((d) => (
                  <th key={d} className="border-b border-slate-200 bg-slate-50/70 px-0.5 py-1.5 text-center text-xs font-medium text-slate-500">
                    <button
                      disabled={d > today}
                      aria-label={`Show ${formatDate(d)}`}
                      aria-current={d === date ? "date" : undefined}
                      onClick={() => setDate(d)}
                      className={`w-6 rounded py-0.5 tabular-nums disabled:cursor-default disabled:text-slate-300 ${d === date ? "bg-slate-900 text-white" : "hover:bg-slate-200/70"}`}
                    >
                      {Number(d.slice(8))}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {active.map((w) => (
                <tr key={w.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-700">{w.name}</td>
                  {dates.map((d) => {
                    const r = byKey.get(`${w.id}|${d}`);
                    return (
                      <td key={d} className="px-0.5 py-2 text-center">
                        <span title={`${formatDate(d)}: ${r ? r.status : "not marked"}`} className={`inline-block size-2.5 rounded-sm ${r ? DOT[r.status] : d > today ? "bg-slate-100" : "bg-slate-200"}`} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-4 border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500">
          {OPTIONS.map((o) => <span key={o.value} className="flex items-center gap-1.5"><span className={`size-2.5 rounded-sm ${o.dot}`} />{o.label}</span>)}
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-slate-200" />Not marked</span>
        </div>
      </Card>
    
      <AttendanceHistory
        onOpenDate={(d) => {
          setDate(d);
          window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        }}
      />
    </>
  );
}
