"use client";

import { useRef, useState } from "react";
import { useStore } from "@/app/lib/merchant/store";
import { useViewer } from "../viewer";
import { formatDate, formatMoney } from "@/app/lib/merchant/format";
import type { Worker } from "@/app/lib/merchant/types";
import { useToast } from "../../feedback/Toaster";
import { Avatar, Button, Card, EmptyState, Field, fieldClass, inputClass, PageHeader, StatusBadge, td, th, thRight } from "../ui";

const EMPTY = { name: "", role: "Delivery Rider", city: "Bengaluru", phone: "", payoutEmail: "", dailyWage: "" };

export function WorkersView() {
  const { workers, addWorker, updateWorker, importCsv } = useStore();
  const { isOwner } = useViewer();
  const toast = useToast();
  const [city, setCity] = useState("all");
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
  const activeCount = workers.filter((w) => w.status === "active").length;

  async function onFile(kind: "workers" | "deliveries", file: File | undefined) {
    if (!file) return;
    const res = await importCsv(kind, await file.text());
    if (res) {
      const title = `Imported ${res.imported} ${kind === "workers" ? "worker" : "delivery"} row${res.imported === 1 ? "" : "s"}`;
      toast(
        res.errors.length
          ? { tone: "warn", title, description: `${res.errors.length} row${res.errors.length === 1 ? "" : "s"} skipped: ${res.errors.slice(0, 3).join("; ")}`, duration: 10000 }
          : { tone: "success", title },
      );
    }
    if (workersFile.current) workersFile.current.value = "";
    if (deliveriesFile.current) deliveriesFile.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const name = form.name.trim();
    const ok = await addWorker({ name, role: form.role.trim(), city: form.city.trim(), phone: form.phone.trim(), payoutEmail: form.payoutEmail.trim(), dailyWage: wage });
    if (!ok) return; // the error toast comes from the store; keep the form so nothing is lost
    toast({ tone: "success", title: `Added ${name}`, description: form.payoutEmail.trim() ? undefined : "Add a PayPal email before their first payout." });
    setForm(EMPTY);
    setShowForm(false);
  }

  function saveWage(w: Worker) {
    const next = Number(wageDraft);
    setEditing(null);
    if (!(next > 0) || next === w.dailyWage) return;
    updateWorker(w.id, { dailyWage: next });
    toast({ tone: "success", title: "Daily wage updated", description: `${w.name}: ${formatMoney(w.dailyWage)} to ${formatMoney(next)}.` });
  }

  function toggleActive(w: Worker) {
    const next = w.status === "active" ? "inactive" : "active";
    updateWorker(w.id, { status: next });
    toast({
      tone: "info",
      sound: false,
      title: next === "inactive" ? `${w.name} deactivated` : `${w.name} reactivated`,
      description: next === "inactive" ? "They won't appear in attendance or new payouts." : undefined,
      action: { label: "Undo", onClick: () => updateWorker(w.id, { status: w.status }) },
    });
  }

  return (
    <>
      <PageHeader
        title="Workers"
        description={isOwner ? `${activeCount} active of ${workers.length}. Manage wages and payout accounts.` : "Your team. Only the owner can change wages or payout accounts."}
        actions={
          isOwner && <>
            <input ref={workersFile} type="file" accept=".csv,text/csv" hidden onChange={(e) => void onFile("workers", e.target.files?.[0])} />
            <input ref={deliveriesFile} type="file" accept=".csv,text/csv" hidden onChange={(e) => void onFile("deliveries", e.target.files?.[0])} />
            <Button onClick={() => workersFile.current?.click()} title="Columns: name, role, city, phone, payoutEmail, dailyWage">Import workers</Button>
            <Button onClick={() => deliveriesFile.current?.click()} title="Columns: worker, date, deliveries, status, overtime">Import deliveries</Button>
            <Button variant="primary" onClick={() => setShowForm((s) => !s)} aria-expanded={showForm}>{showForm ? "Cancel" : "Add worker"}</Button>
          </>
        }
      />
      {showForm && (
        <Card title="New worker" className="mb-5">
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Full name"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="Role"><input className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} required /></Field>
            <Field label="City"><input className={inputClass} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="Daily wage (₹)"><input className={inputClass} type="number" min="1" step="0.5" value={form.dailyWage} onChange={(e) => setForm({ ...form, dailyWage: e.target.value })} required /></Field>
            <Field label="Phone"><input className={inputClass} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="PayPal email" hint="Needed to receive payouts"><input className={inputClass} type="email" value={form.payoutEmail} onChange={(e) => setForm({ ...form, payoutEmail: e.target.value })} /></Field>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit" variant="primary" disabled={!valid}>Save worker</Button>
              <Button variant="ghost" onClick={() => { setForm(EMPTY); setShowForm(false); }}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <Card flush>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2.5">
          <select className={fieldClass("h-8 w-auto min-w-[9rem] px-2.5 text-sm")} aria-label="Filter by city" value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="all">All cities</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="search" className={`${inputClass} max-w-xs`} placeholder="Search name, role or city" aria-label="Search workers" value={query} onChange={(e) => setQuery(e.target.value)} />
          <span className="ml-auto text-xs text-slate-500 tabular-nums">{shown.length} shown</span>
        </div>
        {shown.length === 0 ? <EmptyState>No workers match.</EmptyState> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr><th className={th}>Worker</th><th className={th}>Role</th><th className={thRight}>Daily wage</th><th className={th}>PayPal</th><th className={th}>Joined</th><th className={th}>Status</th><th className={th}><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((w) => (
                  <tr key={w.id} className={w.status === "inactive" ? "bg-slate-50/60 [&>td:not(:last-child)]:opacity-55" : ""}>
                    <td className={td}>
                      <div className="flex items-center gap-2.5"><Avatar name={w.name} /><div className="min-w-0"><p className="font-medium text-slate-900">{w.name}</p><p className="text-xs text-slate-500">{w.phone}</p></div></div>
                    </td>
                    <td className={td}><p>{w.role}</p><p className="text-xs text-slate-500">{w.city}</p></td>
                    <td className={`${td} text-right tabular-nums`}>
                      {!isOwner ? formatMoney(w.dailyWage) : editing === w.id ? (
                        <form className="flex items-center justify-end gap-1" onSubmit={(e) => {
                          e.preventDefault();
                          saveWage(w);
                        }}>
                          <input autoFocus className={fieldClass("h-7 w-20 px-2 text-right text-sm tabular-nums")} type="number" min="1" step="0.5" value={wageDraft} onChange={(e) => setWageDraft(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setEditing(null)} aria-label={`Daily wage for ${w.name}`} />
                          <Button type="submit" variant="primary" size="sm">Save</Button>
                        </form>
                      ) : (
                        <button className="-mx-1 rounded px-1 underline decoration-slate-300 decoration-dotted underline-offset-4 hover:bg-slate-100 hover:decoration-slate-500" onClick={() => { setEditing(w.id); setWageDraft(String(w.dailyWage)); }} title="Edit daily wage">
                          {formatMoney(w.dailyWage)}
                        </button>
                      )}
                    </td>
                    <td className={`${td} max-w-[13rem] truncate`}>{w.payoutEmail || <span className="text-xs font-medium text-rose-700">Missing</span>}</td>
                    <td className={`${td} whitespace-nowrap`}>{formatDate(w.joinedOn)}</td>
                    <td className={td}><StatusBadge status={w.status} /></td>
                    <td className={`${td} text-right`}>
                      {isOwner && (
                        <Button variant="ghost" size="sm" onClick={() => toggleActive(w)}>
                          {w.status === "active" ? "Deactivate" : "Reactivate"}
                        </Button>
                      )}
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
