import { respond } from "@/app/lib/server/http";
import { retryTransaction } from "@/app/lib/server/service";

export async function POST(_req: Request, ctx: RouteContext<"/api/transactions/[id]/retry">) {
  const { id } = await ctx.params;
  return respond(() => retryTransaction(id));
}
