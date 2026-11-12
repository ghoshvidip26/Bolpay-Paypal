"use client";

import { useEffect, useState } from "react";
import { Segmented } from "./ui";

type Workspace = "demo" | "zoho";

/**
 * Switches the whole app between the trained demo dataset and the data synced from Zoho People.
 * The two datasets are fully separate (own workers, attendance, payouts, transactions).
 */
export function WorkspaceSwitch() {
  const [workspace, setWorkspace] = useState<Workspace | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/workspace")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { workspace?: Workspace } | null) => {
        if (!cancelled && d?.workspace) setWorkspace(d.workspace);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function change(next: Workspace) {
    if (next === workspace || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace: next }) });
      if (res.ok) window.location.assign(new URL("/dashboard", window.location.origin).href); // a full reload so every screen loads the other dataset
    } finally {
      setBusy(false);
    }
  }

  if (!workspace) return null;
  return (
    <div className="mt-4 hidden border-t border-slate-200 px-1 pt-3 md:block">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">Dataset</p>
      <Segmented<Workspace>
        label="Dataset"
        value={workspace}
        disabled={busy}
        onChange={(v) => void change(v)}
        options={[
          { value: "demo", label: "Demo", dot: "bg-teal-600" },
          { value: "zoho", label: "Zoho HRMS", dot: "bg-sky-600" },
        ]}
      />
    </div>
  );
}
