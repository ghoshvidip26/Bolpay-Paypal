import { OWNER, readJson, respond, STAFF } from "@/app/lib/server/http";
import { getWorkspace, setWorkspace, WORKSPACES, type Workspace } from "@/app/lib/server/db";
import { ServiceError } from "@/app/lib/server/service";

/** GET: which dataset the app is showing ("demo" or "zoho"). */
export async function GET() {
  return respond(() => ({ workspace: getWorkspace() }), STAFF);
}

/** POST { workspace: "demo" | "zoho" }: switch the dataset for the whole app. Owners only. */
export async function POST(req: Request) {
  return respond(async () => {
    const b = await readJson(req);
    if (!WORKSPACES.includes(b.workspace as Workspace)) throw new ServiceError('workspace must be "demo" or "zoho"');
    setWorkspace(b.workspace as Workspace);
    return { workspace: getWorkspace() };
  }, OWNER);
}
