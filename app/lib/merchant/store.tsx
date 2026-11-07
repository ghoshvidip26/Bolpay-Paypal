"use client";

/**
 * Client store for the merchant app. The server owns the data and all pay/approval logic;
 * this store mirrors the latest server snapshot and calls the /api routes.
 *  - High-frequency edits (attendance, rules, worker edits) are applied optimistically and
 *    written to the server in order.
 *  - Everything that creates or moves money waits for the server's snapshot.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { calculatePay } from "./incentives";
import { CURRENT_PERIOD, TODAY } from "./mock-data";
import type { AttendanceRecord, AttendanceStatus, IncentiveRules, Payout, Period, Transaction, Worker } from "./types";

export interface Snapshot {
  today: string;
  period: Period;
  workers: Worker[];
  attendance: AttendanceRecord[];
  rules: IncentiveRules;
  payouts: Payout[];
  transactions: Transaction[];
}

type Action =
  | { type: "replace"; snapshot: Snapshot }
  | { type: "updateWorker"; id: string; patch: Partial<Worker> }
  | { type: "setAttendance"; workerId: string; date: string; patch: Partial<AttendanceRecord> }
  | { type: "setRules"; rules: IncentiveRules };

const EMPTY: Snapshot = {
  today: TODAY,
  period: CURRENT_PERIOD,
  workers: [],
  attendance: [],
  rules: { workingHoursPerDay: 8, overtimeMultiplier: 1.5, dailyUnitTarget: 0, ratePerExtraUnit: 0, attendanceThreshold: 1, attendanceBonus: 0, deliveryTiers: [], version: 1 },
  payouts: [],
  transactions: [],
};

function reducer(state: Snapshot, action: Action): Snapshot {
  switch (action.type) {
    case "replace":
      return action.snapshot;
    case "updateWorker":
      return { ...state, workers: state.workers.map((w) => (w.id === action.id ? { ...w, ...action.patch } : w)) };
    case "setAttendance": {
      const exists = state.attendance.some((r) => r.workerId === action.workerId && r.date === action.date);
      const attendance = exists
        ? state.attendance.map((r) => (r.workerId === action.workerId && r.date === action.date ? { ...r, ...action.patch } : r))
        : [...state.attendance, { workerId: action.workerId, date: action.date, status: "present" as const, overtimeHours: 0, units: 0, ...action.patch }];
      return { ...state, attendance };
    }
    case "setRules":
      return { ...state, rules: action.rules };
  }
}

interface Store extends Snapshot {
  loaded: boolean;
  error: string | null;
  dismissError: () => void;
  addWorker: (w: { name: string; role: string; city: string; phone: string; payoutEmail: string; dailyWage: number }) => Promise<void>;
  importCsv: (kind: "workers" | "deliveries", csv: string) => Promise<{ imported: number; errors: string[] } | null>;
  updateWorker: (id: string, patch: Partial<Worker>) => void;
  setAttendance: (workerId: string, date: string, patch: Partial<AttendanceRecord>) => void;
  markStatus: (workerId: string, date: string, status: AttendanceStatus) => void;
  setRules: (rules: IncentiveRules) => void;
  submitPeriodForApproval: (filter?: { city?: string | null; minUnits?: number | null; date?: string | null }) => Promise<{ created: number; needsReview: number; skipped: number }>;
  approvePayouts: (ids: string[]) => Promise<void>;
  rejectPayouts: (ids: string[]) => Promise<void>;
  retryTransaction: (id: string) => Promise<void>;
  workerById: (id: string) => Worker | undefined;
}

const StoreContext = createContext<Store | null>(null);
const POLL_MS = 4000;

type ApiResult = { state?: Snapshot; error?: string; created?: number; needsReview?: number; skipped?: number; import?: { imported: number; errors: string[] } };

async function request(method: string, path: string, body?: unknown): Promise<ApiResult & { ok: boolean }> {
  try {
    const res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as ApiResult;
    return { ...data, ok: res.ok };
  } catch {
    return { ok: false, error: "Could not reach the server" };
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Applies a server response; returns whether it succeeded. */
  const apply = useCallback((r: ApiResult & { ok: boolean }) => {
    if (r.state) dispatch({ type: "replace", snapshot: r.state });
    if (!r.ok) setError(r.error ?? "Something went wrong");
    return r.ok;
  }, []);

  const refresh = useCallback(async () => {
    const r = await request("GET", "/api/state");
    apply(r);
    if (r.ok) setLoaded(true);
  }, [apply]);

  useEffect(() => {
    let cancelled = false;
    void request("GET", "/api/state").then((r) => {
      if (cancelled) return;
      apply(r);
      if (r.ok) setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  // Optimistic writes go through one queue so they reach the server in the order they were made.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback(
    (method: string, path: string, body: unknown) => {
      queue.current = queue.current.then(async () => {
        const r = await request(method, path, body);
        if (!r.ok) {
          setError(r.error ?? "Could not save your change");
          await refresh(); // roll the optimistic edit back to the server's truth
        }
      });
    },
    [refresh],
  );

  // While any payment is in flight, ask the server to re-check PayPal.
  const hasProcessing = state.transactions.some((t) => t.status === "processing");
  useEffect(() => {
    if (!hasProcessing) return;
    const handle = setInterval(async () => {
      const r = await request("POST", "/api/payouts/sync");
      if (r.state) dispatch({ type: "replace", snapshot: r.state });
    }, POLL_MS);
    return () => clearInterval(handle);
  }, [hasProcessing]);

  const store = useMemo<Store>(() => {
    const act = async (method: string, path: string, body?: unknown) => apply(await request(method, path, body));
    return {
      ...state,
      loaded,
      error,
      dismissError: () => setError(null),
      addWorker: async (w) => void (await act("POST", "/api/workers", w)),
      updateWorker: (id, patch) => {
        dispatch({ type: "updateWorker", id, patch });
        enqueue("PATCH", `/api/workers/${encodeURIComponent(id)}`, patch);
      },
      setAttendance: (workerId, date, patch) => {
        dispatch({ type: "setAttendance", workerId, date, patch });
        enqueue("PUT", "/api/attendance", { workerId, date, patch });
      },
      markStatus: (workerId, date, status) => {
        const patch = status === "absent" || status === "leave" ? { status, overtimeHours: 0, units: 0 } : { status };
        dispatch({ type: "setAttendance", workerId, date, patch });
        enqueue("PUT", "/api/attendance", { workerId, date, patch });
      },
      setRules: (rules) => {
        dispatch({ type: "setRules", rules });
        enqueue("PUT", "/api/rules", rules);
      },
      submitPeriodForApproval: async (filter) => {
        // Make sure queued attendance edits are saved before the server computes pay.
        await queue.current;
        const r = await request("POST", "/api/payouts/submit-period", filter ?? {});
        return apply(r) ? { created: r.created ?? 0, needsReview: r.needsReview ?? 0, skipped: r.skipped ?? 0 } : { created: 0, needsReview: 0, skipped: 0 };
      },
      importCsv: async (kind, csv) => {
        await queue.current;
        const r = await request("POST", "/api/import", { kind, csv });
        return apply(r) ? (r.import ?? null) : null;
      },
      approvePayouts: async (ids) => void (await act("POST", "/api/payouts/decide", { ids, decision: "approved" })),
      rejectPayouts: async (ids) => void (await act("POST", "/api/payouts/decide", { ids, decision: "rejected" })),
      retryTransaction: async (id) => void (await act("POST", `/api/transactions/${encodeURIComponent(id)}/retry`)),
      workerById: (id) => state.workers.find((w) => w.id === id),
    };
  }, [state, loaded, error, apply, enqueue]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

/** Records within the current pay period. */
export function usePeriodRecords() {
  const { attendance, period } = useStore();
  return useMemo(() => attendance.filter((r) => r.date >= period.start && r.date <= period.end), [attendance, period]);
}

/** Live pay preview for every active worker (the server recomputes this when payouts are submitted). */
export function usePeriodPay() {
  const { workers, rules } = useStore();
  const records = usePeriodRecords();
  return useMemo(
    () => workers.filter((w) => w.status === "active").map((w) => ({ worker: w, pay: calculatePay(w, records, rules) })),
    [workers, rules, records],
  );
}
