import { respond, readJson } from "@/app/lib/server/http";
import { setRules } from "@/app/lib/server/service";

export async function PUT(req: Request) {
  return respond(async () => setRules(await readJson(req)));
}
