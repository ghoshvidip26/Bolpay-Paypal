import { cookies } from "next/headers";
import { readJson, respond, STAFF } from "@/app/lib/server/http";
import { getWorkspace, WORKSPACE_COOKIE, WORKSPACES, type Workspace } from "@/app/lib/server/db";
import { ServiceError } from "@/app/lib/server/service";

/** GET: which dataset the signed-in person is viewing ("demo" or "zoho"). */
export async function GET() {
  return respond(() => ({ workspace: getWorkspace() }), STAFF);
}

/**
 * POST { workspace: "demo" | "zoho" }: switch the dataset for the person calling only, kept in their own
 * cookie. Everyone else keeps their view. Owners and supervisors can switch; roles still decide what they
 * may do inside either dataset.
 */
export async function POST(req: Request) {
  return respond(async () => {
    const b = await readJson(req);
    if (!WORKSPACES.includes(b.workspace as Workspace)) throw new ServiceError('workspace must be "demo" or "zoho"');
    const next = b.workspace as Workspace;
    (await cookies()).set(WORKSPACE_COOKIE, next, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    // This request still ran on the old dataset; the client reloads to pick up the new one.
    return { workspace: next };
  }, STAFF);
}
