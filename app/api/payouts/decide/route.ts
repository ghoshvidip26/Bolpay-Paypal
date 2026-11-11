import { respond, readJson, OWNER } from "@/app/lib/server/http";
import { decidePayouts, ServiceError } from "@/app/lib/server/service";

const MAX_IDS = 200;

/**
 * POST { ids: string[], decision: "approved" | "rejected" }
 * Approving starts the PayPal transfers. Amounts and recipients are read from the server's
 * own payout records, never from this request.
 */
export async function POST(req: Request) {
  return respond(async () => {
    const b = await readJson(req);
    const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is string => typeof x === "string") : [];
    if (ids.length === 0 || ids.length > MAX_IDS) throw new ServiceError(`Provide between 1 and ${MAX_IDS} payout ids`);
    if (b.decision !== "approved" && b.decision !== "rejected") throw new ServiceError("decision must be approved or rejected");
    await decidePayouts(ids, b.decision);
  }, OWNER);
}
