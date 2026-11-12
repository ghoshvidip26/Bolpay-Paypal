import "server-only";
import { CURRENT_PERIOD, TODAY } from "@/app/lib/merchant/mock-data";
import type { Period } from "@/app/lib/merchant/types";
import { getWorkspace, type Workspace } from "./db";

/**
 * "Today" and the current pay period for the active workspace.
 * The demo dataset is pinned to fixed dates so the trained demo always looks the same.
 * The Zoho workspace holds real data, so it uses the real date (India time) and the calendar month.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function getToday(ws: Workspace = getWorkspace()): string {
  if (ws === "demo") return TODAY;
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function getPeriod(ws: Workspace = getWorkspace()): Period {
  if (ws === "demo") return CURRENT_PERIOD;
  const [y, m] = getToday(ws).split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { id: `zoho-${y}-${mm}`, label: `${MONTHS[m - 1]} ${y}`, start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}
