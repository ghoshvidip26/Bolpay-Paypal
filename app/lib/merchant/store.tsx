"use client";

/**
 * Client-side store for the merchant app. It is seeded with mock data and is
 * the single seam to replace with real API calls once the backend exists:
 * each action below maps to one endpoint.
 */
import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { calculatePay, DEFAULT_RULES } from "./incentives";
import { CURRENT_PERIOD, SEED_ATTENDANCE, SEED_PAYOUTS, SEED_TRANSACTIONS, SEED_WORKERS, TODAY } from "./mock-data";
import type {
  AttendanceRecord,
  AttendanceStatus,
  IncentiveRules,
  Payout,
  Period,
  Transaction,
  Worker,
} from "./types";

interface State {
  today: string;
  period: Period;
  workers: Worker[];
  attendance: AttendanceRecord[];
  rules: IncentiveRules;
  payouts: Payout[];
  transactions: Transaction[];
}

type Action =
  | { type: "addWorker"; worker: Worker }
  | { type: "updateWorker"; id: string; patch: Partial<Worker> }
  | { type: "setAttendance"; workerId: string; date: string; patch: Partial<AttendanceRecord> }
  | { type: "setRules"; rules: IncentiveRules }
  | { type: "submitPayouts"; payouts: Payout[] }
  | { type: "decidePayouts"; ids: string[]; decision: "approved" | "rejected"; now: string; transactions: Transaction[] }
  | { type: "settleTransaction"; id: string; status: "completed" | "failed"; failureReason?: string }
  | { type: "retryTransaction"; id: string };

const initial: State = {
  today: TODAY,
  period: CURRENT_PERIOD,
  workers: SEED_WORKERS,
  attendance: SEED_ATTENDANCE,
  rules: DEFAULT_RULES,
  payouts: SEED_PAYOUTS,
  transactions: SEED_TRANSACTIONS,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "addWorker":
      return { ...state, workers: [...state.workers, action.worker] };
    case "updateWorker":
      return {
        ...state,
        workers: state.workers.map((w) => (w.id === action.id ? { ...w, ...action.patch } : w)),
      };
    case "setAttendance": {
      const exists = state.attendance.some((r) => r.workerId === action.workerId && r.date === action.date);
      const attendance = exists
        ? state.attendance.map((r) =>
            r.workerId === action.workerId && r.date === action.date ? { ...r, ...action.patch } : r,
          )
        : [
            ...state.attendance,
            { workerId: action.workerId, date: action.date, status: "present" as const, overtimeHours: 0, units: 0, ...action.patch },
          ];
      return { ...state, attendance };
    }
    case "setRules":
      return { ...state, rules: action.rules };
    case "submitPayouts":
      return { ...state, payouts: [...state.payouts, ...action.payouts] };
    case "decidePayouts":
      return {
        ...state,
        payouts: state.payouts.map((p) =>
          action.ids.includes(p.id) && p.status === "pending" ? { ...p, status: action.decision, decidedAt: action.now } : p,
        ),
        transactions: [...state.transactions, ...action.transactions],
      };
    case "settleTransaction":
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === action.id ? { ...t, status: action.status, failureReason: action.failureReason } : t,
        ),
      };
    case "retryTransaction":
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === action.id ? { ...t, status: "processing", failureReason: undefined } : t,
        ),
      };
  }
}

interface Store extends State {
  addWorker: (w: Omit<Worker, "id" | "joinedOn" | "status">) => void;
  updateWorker: (id: string, patch: Partial<Worker>) => void;
  setAttendance: (workerId: string, date: string, patch: Partial<AttendanceRecord>) => void;
  markStatus: (workerId: string, date: string, status: AttendanceStatus) => void;
  setRules: (rules: IncentiveRules) => void;
  submitPeriodForApproval: () => number;
  approvePayouts: (ids: string[]) => void;
  rejectPayouts: (ids: string[]) => void;
  retryTransaction: (id: string) => void;
  workerById: (id: string) => Worker | undefined;
}

const StoreContext = createContext<Store | null>(null);

const SETTLE_DELAY_MS = 2500;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Simulates the payment rail: anything "processing" settles shortly after.
  // Replace with polling / webhooks from the backend later.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    for (const t of state.transactions) {
      if (t.status !== "processing" || timers.current.has(t.id)) continue;
      const handle = setTimeout(() => {
        timers.current.delete(t.id);
        const worker = stateRef.current.workers.find((w) => w.id === t.workerId);
        if (!worker?.payoutEmail) {
          dispatch({ type: "settleTransaction", id: t.id, status: "failed", failureReason: "Worker has no PayPal account on file" });
        } else {
          dispatch({ type: "settleTransaction", id: t.id, status: "completed" });
        }
      }, SETTLE_DELAY_MS);
      timers.current.set(t.id, handle);
    }
  }, [state.transactions]);
  useEffect(() => {
    const map = timers.current;
    return () => map.forEach(clearTimeout);
  }, []);

  const store = useMemo<Store>(() => {
    const decide = (ids: string[], decision: "approved" | "rejected") => {
      const now = new Date().toISOString();
      const pending = stateRef.current.payouts.filter((p) => ids.includes(p.id) && p.status === "pending");
      const transactions: Transaction[] =
        decision === "approved"
          ? pending.map((p) => ({
              id: `tx-${p.id}-${now}`,
              payoutId: p.id,
              workerId: p.workerId,
              periodLabel: p.periodLabel,
              amount: p.amount,
              status: "processing",
              createdAt: now,
              reference: `PP-${Math.floor(10000 + Math.random() * 89999)}`,
            }))
          : [];
      dispatch({ type: "decidePayouts", ids, decision, now, transactions });
    };

    return {
      ...state,
      addWorker: (w) =>
        dispatch({
          type: "addWorker",
          worker: { ...w, id: `w${Date.now()}`, joinedOn: stateRef.current.today, status: "active" },
        }),
      updateWorker: (id, patch) => dispatch({ type: "updateWorker", id, patch }),
      setAttendance: (workerId, date, patch) => dispatch({ type: "setAttendance", workerId, date, patch }),
      markStatus: (workerId, date, status) =>
        dispatch({
          type: "setAttendance",
          workerId,
          date,
          patch: status === "absent" || status === "leave" ? { status, overtimeHours: 0, units: 0 } : { status },
        }),
      setRules: (rules) => dispatch({ type: "setRules", rules }),
      submitPeriodForApproval: () => {
        const s = stateRef.current;
        const already = new Set(s.payouts.filter((p) => p.periodId === s.period.id).map((p) => p.workerId));
        const records = s.attendance.filter((r) => r.date >= s.period.start && r.date <= s.period.end);
        const now = new Date().toISOString();
        const payouts = s.workers
          .filter((w) => w.status === "active" && !already.has(w.id))
          .map((w): Payout => {
            const breakdown = calculatePay(w, records, s.rules);
            return {
              id: `po-${s.period.id}-${w.id}`,
              workerId: w.id,
              periodId: s.period.id,
              periodLabel: s.period.label,
              breakdown,
              amount: breakdown.total,
              status: "pending",
              submittedAt: now,
            };
          })
          .filter((p) => p.amount > 0);
        if (payouts.length) dispatch({ type: "submitPayouts", payouts });
        return payouts.length;
      },
      approvePayouts: (ids) => decide(ids, "approved"),
      rejectPayouts: (ids) => decide(ids, "rejected"),
      retryTransaction: (id) => dispatch({ type: "retryTransaction", id }),
      workerById: (id) => state.workers.find((w) => w.id === id),
    };
  }, [state]);

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
  return useMemo(
    () => attendance.filter((r) => r.date >= period.start && r.date <= period.end),
    [attendance, period],
  );
}

/** Live pay breakdown for every active worker in the current period. */
export function usePeriodPay() {
  const { workers, rules } = useStore();
  const records = usePeriodRecords();
  return useMemo(
    () =>
      workers
        .filter((w) => w.status === "active")
        .map((w) => ({ worker: w, pay: calculatePay(w, records, rules) })),
    [workers, rules, records],
  );
}
