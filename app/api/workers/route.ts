import { respond, readJson, OWNER } from "@/app/lib/server/http";
import { addWorker } from "@/app/lib/server/service";

export async function POST(req: Request) {
  return respond(async () => addWorker(await readJson(req)), OWNER);
}
