"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/app/lib/merchant/store";
import { dateRange, formatDate } from "@/app/lib/merchant/format";
import type { AttendanceStatus } from "@/app/lib/merchant/types";
import { Avatar, Button, Card, EmptyState, inputClass, PageHeader, td, th } from "../ui";

const OPTIONS: { value: AttendanceStatus; label: string; active: string }[] = [
  { value: "present", label: "Present", active: "bg-emerald-600 text-white border-emerald-600" },
  { value: "half", label: "Half", active: "bg-amber-500 text-white border-amber-500" },
  { value: "absent", label: "Absent", active: "bg-rose-600 text-white border-rose-600" },
  { value: "leave", label: "Leave", active: "bg-sky-600 text-white border-sky-600" },
];
const DOT: Record<AttendanceStatus, string> = { present: "bg-emerald-500", half: "bg-amber-400", absent: "bg-rose-500", leave: "bg-sky-500" };

export function AttendanceView() {
  const { workers, attendance, period, today, markStatus, setAttendance } = useStore();
  const [date, setDate] = useState(today);
  const dates = useMemo(() => dateRange(period.start, period.end), [period]);
  const active = workers.filter((w) => w.status === "active");
  const day = attendance.filter((r) => r.date === date);
  const byWorker = new Map(day.map((r) => [r.workerId, r]));
  const unmarked = active.filter((w) => !byWorker.has(w.id));
  const isFuture = date > today;

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Mark who showed up, overtime hours and units completed."
        actions={
          <>
            <Button onClick={() => unmarked.forEach((w) => markStatus(w.id, date, "present"))} disabled={isFuture || unmarked.length === 0}>
              Mark remaining present ({unmarked.length})
            </Button>
          </>
        }
      />

      <Card title={`${formatDate(date)}${date === today ? " (today)" : ""}`} className="mb-6"
        actions={<input type="date" aria-label="Attendance date" className={`${inputClass} w-auto`} min={period.start} max={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />}
        flush>
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
                      <td className={td}><div className="flex items-center gap-3"><Avatar name={w.name} /><div><p className="font-medium text-slate-900">{w.name}</p><p className="text-xs text-slate-500">{w.role}</p></div></div></td>
                      <td className={td}>
                        <div role="group" aria-label={`Attendance for ${w.name}`} className="inline-flex overflow-hidden rounded-lg border border-slate-300">
                          {OPTIONS.map((o) => (
                            <button
                              key={o.value}
                              disabled={isFuture}
                              aria-pressed={rec?.status === o.value}
                              onClick={() => markStatus(w.id, date, o.value)}
                              className={`border-r border-slate-300 px-2.5 py-1 text-xs font-medium last:border-r-0 disabled:opacity-50 ${rec?.status === o.value ? o.active : "bg-white text-slate-600 hover:bg-slate-50"}`}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                        {!rec && <span className="ml-2 text-xs text-amber-600">Not marked</span>}
                      </td>
                      <td className={td}>
                        <input type="number" min="0" max="12" step="0.5" disabled={!worked} aria-label={`Overtime hours for ${w.name}`} className={`${inputClass} w-20 disabled:bg-slate-50`}
                          value={rec?.overtimeHours ?? 0} onChange={(e) => setAttendance(w.id, date, { overtimeHours: Math.max(0, Number(e.target.value)) })} />
                      </td>
                      <td className={td}>
                        <input type="number" min="0" step="1" disabled={!worked} aria-label={`Units completed by ${w.name}`} className={`${inputClass} w-24 disabled:bg-slate-50`}
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
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className={th}>Worker</th>
                {dates.map((d) => (
                  <th key={d} className="px-1 py-2.5 text-center font-medium text-slate-500">
                    <button className={`rounded px-1 ${d === date ? "bg-teal-100 text-teal-800" : "hover:bg-slate-100"}`} onClick={() => d <= today && setDate(d)}>{Number(d.slice(8))}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {active.map((w) => (
                <tr key={w.id}>
                  <td className="whitespace-nowrap px-5 py-2.5 text-sm text-slate-700">{w.name}</td>
                  {dates.map((d) => {
                    const r = attendance.find((a) => a.workerId === w.id && a.date === d);
                    return (
                      <td key={d} className="px-1 py-2.5 text-center">
                        <span title={r ? `${d}: ${r.status}` : `${d}: not marked`} className={`inline-block size-3 rounded-full ${r ? DOT[r.status] : "bg-slate-200"}`} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          {OPTIONS.map((o) => <span key={o.value} className="flex items-center gap-1.5"><span className={`size-2.5 rounded-full ${DOT[o.value]}`} />{o.label}</span>)}
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-slate-200" />Not marked</span>
        </div>
      </Card>
    </>
  );
}
