import { respond, readJson, OWNER } from "@/app/lib/server/http";
import { updateWorker } from "@/app/lib/server/service";

export async function PATCH(req: Request, ctx: RouteContext<"/api/workers/[id]">) {
  const { id } = await ctx.params;
  return respond(async () => updateWorker(id, await readJson(req)), OWNER);
}
