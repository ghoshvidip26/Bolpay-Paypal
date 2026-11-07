import { respond } from "@/app/lib/server/http";
import { submitPeriod, type PrepareFilter } from "@/app/lib/server/service";

/**
 * Computes the current period on the server and queues payouts for approval.
 * Optional JSON body: { city?, minUnits?, date? } to prepare only a subset of workers.
 */
export async function POST(req: Request) {
  let filter: PrepareFilter = {};
  try {
    const b = (await req.json()) as Record<string, unknown>;
    filter = {
      city: typeof b.city === "string" && b.city.trim() ? b.city.trim().slice(0, 60) : null,
      minUnits: typeof b.minUnits === "number" && Number.isFinite(b.minUnits) && b.minUnits >= 0 ? b.minUnits : null,
      date: typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : null,
    };
  } catch {
    /* no body: prepare everyone */
  }
  return respond(() => ({ ...submitPeriod(filter) }));
}
