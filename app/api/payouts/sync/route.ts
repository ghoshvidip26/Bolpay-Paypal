import { respond, OWNER } from "@/app/lib/server/http";
import { syncTransactions } from "@/app/lib/server/service";

/** Refreshes processing transactions from PayPal, then returns the latest state. */
export async function POST() {
  return respond(() => syncTransactions(), OWNER);
}
