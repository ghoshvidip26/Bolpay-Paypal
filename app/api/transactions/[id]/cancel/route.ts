import { respond, OWNER } from "@/app/lib/server/http";
import { cancelUnclaimed } from "@/app/lib/server/service";

/** POST: cancel a payment that is waiting for the recipient's PayPal sign-up and refund it. Owners only. */
export async function POST(_req: Request, ctx: RouteContext<"/api/transactions/[id]/cancel">) {
  const { id } = await ctx.params;
  return respond(() => cancelUnclaimed(id), OWNER);
}
