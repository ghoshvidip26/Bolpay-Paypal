import { respond } from "@/app/lib/server/http";
import { submitPeriod } from "@/app/lib/server/service";

/** Computes the current period on the server and queues payouts for approval. */
export async function POST() {
  return respond(() => ({ created: submitPeriod() }));
}
