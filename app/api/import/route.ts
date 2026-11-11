import { readJson, respond, OWNER } from "@/app/lib/server/http";
import { importDeliveries, importWorkers, ServiceError } from "@/app/lib/server/service";

const MAX_CSV_CHARS = 1_000_000;

/**
 * POST { kind: "workers" | "deliveries", csv: string }
 * workers columns:    name, role, city, phone, payoutEmail, dailyWage
 * deliveries columns: worker (name or id), date, deliveries, status, overtime
 */
export async function POST(req: Request) {
  return respond(async () => {
    const b = await readJson(req);
    if (typeof b.csv !== "string" || !b.csv.trim()) throw new ServiceError("Provide the CSV text");
    if (b.csv.length > MAX_CSV_CHARS) throw new ServiceError("CSV is too large", 413);
    if (b.kind === "workers") return { import: importWorkers(b.csv) };
    if (b.kind === "deliveries") return { import: importDeliveries(b.csv) };
    throw new ServiceError('kind must be "workers" or "deliveries"');
  }, OWNER);
}
