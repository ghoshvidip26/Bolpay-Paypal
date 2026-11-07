"use client";

import { useRef, useState } from "react";
import { useStore } from "@/app/lib/merchant/store";
import { formatDate, formatMoney } from "@/app/lib/merchant/format";
import { Avatar, Button, Card, EmptyState, Field, inputClass, PageHeader, StatusBadge, td, th } from "../ui";

const EMPTY = { name: "", role: "Delivery Rider", city: "Bengaluru", phone: "", payoutEmail: "", dailyWage: "" };

export function WorkersView() {
  const { workers, addWorker, updateWorker, importCsv } = useStore();
  const [city, setCity] = useState("all");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const workersFile = useRef<HTMLInputElement>(null);
  const deliveriesFile = useRef<HTMLInputElement>(null);
  const cities = [...new Set(workers.map((w) => w.city).filter(Boolean))].sort();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [wageDraft, setWageDraft] = useState("");

  const wage = Number(form.dailyWage);
  const valid = form.name.trim() && form.role.trim() && wage > 0;
  const shown = workers.filter((w) => (city === "all" || w.city === city) && `${w.name} ${w.role} ${w.city}`.toLowerCase().includes(query.toLowerCase()));

  async function onFile(kind: "workers" | "deliveries", file: File | undefined) {
    if (!file) return;
    const res = await importCsv(kind, await file.text());
    if (res) setImportMsg(`Imported ${res.imported} ${kind === "workers" ? "worker" : "delivery"} row${res.imported === 1 ? "" : "s"}.${res.errors.length ? ` ${res.errors.length} problem${res.errors.length === 1 ? "" : "s"}: ${res.errors.slice(0, 3).join(" | ")}` : ""}`);
    if (workersFile.current) workersFile.current.value = "";
    if (deliveriesFile.current) deliveriesFile.current.value = "";
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    addWorker({ name: form.name.trim(), role: form.role.trim(), city: form.city.trim(), phone: form.phone.trim(), payoutEmail: form.payoutEmail.trim(), dailyWage: wage });
    setForm(EMPTY);
    setShowForm(false);
  }

  return (
    <>
      <PageHeader
        title="Workers"
        description="Manage your team, daily wages and payout accounts."
        actions={
          <div className="flex flex-wrap gap-2">
            <input ref={workersFile} type="file" accept=".csv,text/csv" hidden onChange={(e) => void onFile("workers", e.target.files?.[0])} />
            <input ref={deliveriesFile} type="file" accept=".csv,text/csv" hidden onChange={(e) => void onFile("deliveries", e.target.files?.[0])} />
            <Button onClick={() => workersFile.current?.click()} title="Columns: name, role, city, phone, payoutEmail, dailyWage">Import workers CSV</Button>
            <Button onClick={() => deliveriesFile.current?.click()} title="Columns: worker, date, deliveries, status, overtime">Import deliveries CSV</Button>
            <Button variant="primary" onClick={() => setShowForm((s) => !s)}>{showForm ? "Close" : "Add worker"}</Button>
          </div>
        }
      />
      {importMsg && (
        <div role="status" className="mb-4 flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          {importMsg}
          <button className="font-medium underline" onClick={() => setImportMsg(null)}>Dismiss</button>
        </div>
      )}

      {showForm && (
        <Card title="New worker" className="mb-6">
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Full name"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="Role"><input className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} required /></Field>
            <Field label="City"><input className={inputClass} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="Daily wage (₹)"><input className={inputClass} type="number" min="1" step="0.5" value={form.dailyWage} onChange={(e) => setForm({ ...form, dailyWage: e.target.value })} required /></Field>
            <Field label="Phone"><input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="PayPal email"><input className={inputClass} type="email" value={form.payoutEmail} onChange={(e) => setForm({ ...form, payoutEmail: e.target.value })} placeholder="Needed to receive payouts" /></Field>
            <div className="flex items-end"><Button type="submit" variant="primary" disabled={!valid}>Save worker</Button></div>
          </form>
        </Card>
      )}

      <Card flush>
        <div className="border-b border-slate-100 p-4">
          <select className={`${inputClass} mr-3 max-w-[10rem]`} aria-label="Filter by city" value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="all">All cities</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className={`${inputClass} max-w-xs`} placeholder="Search by name, role or city" aria-label="Search workers" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {shown.length === 0 ? <EmptyState>No workers match.</EmptyState> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr><th className={th}>Worker</th><th className={th}>Role</th><th className={th}>City</th><th className={th}>Daily wage</th><th className={th}>PayPal</th><th className={th}>Joined</th><th className={th}>Status</th><th className={th} /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((w) => (
                  <tr key={w.id} className={w.status === "inactive" ? "opacity-60" : ""}>
                    <td className={td}>
                      <div className="flex items-center gap-3"><Avatar name={w.name} /><div><p className="font-medium text-slate-900">{w.name}</p><p className="text-xs text-slate-500">{w.phone}</p></div></div>
                    </td>
                    <td className={td}>{w.role}</td>
                    <td className={td}>{w.city}</td>
                    <td className={`${td} tabular-nums`}>
                      {editing === w.id ? (
                        <form className="flex items-center gap-1" onSubmit={(e) => {
                          e.preventDefault();
                          if (Number(wageDraft) > 0) updateWorker(w.id, { dailyWage: Number(wageDraft) });
                          setEditing(null);
                        }}>
                          <input autoFocus className={`${inputClass} w-20`} type="number" min="1" step="0.5" value={wageDraft} onChange={(e) => setWageDraft(e.target.value)} aria-label={`Daily wage for ${w.name}`} />
                          <Button type="submit" variant="primary">Save</Button>
                        </form>
                      ) : (
                        <button className="hover:underline" onClick={() => { setEditing(w.id); setWageDraft(String(w.dailyWage)); }} title="Click to edit">{formatMoney(w.dailyWage)}</button>
                      )}
                    </td>
                    <td className={td}>{w.payoutEmail || <span className="text-rose-600">Missing</span>}</td>
                    <td className={td}>{formatDate(w.joinedOn)}</td>
                    <td className={td}><StatusBadge status={w.status} /></td>
                    <td className={`${td} text-right`}>
                      <Button variant="ghost" onClick={() => updateWorker(w.id, { status: w.status === "active" ? "inactive" : "active" })}>
                        {w.status === "active" ? "Deactivate" : "Reactivate"}
                      </Button>
                    </td>
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
