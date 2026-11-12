import { OWNER, respond } from "@/app/lib/server/http";
import { ServiceError } from "@/app/lib/server/service";
import { connection, ZohoError, zohoConfigured } from "@/app/lib/zoho/client";
import { syncZoho } from "@/app/lib/zoho/sync";

/** POST: pulls employees and this period's attendance from Zoho People into the Zoho dataset. Owners only. */
export async function POST() {
  return respond(async () => {
    if (!zohoConfigured()) throw new ServiceError("Zoho is not configured. Add ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET to .env.", 400);
    if (!connection()) throw new ServiceError("Zoho is not connected. Use Connect Zoho first.", 400);
    try {
      return { sync: await syncZoho() };
    } catch (err) {
      if (err instanceof ZohoError) throw new ServiceError(err.message, err.status === 403 ? 403 : 502);
      throw err;
    }
  }, OWNER);
}

/** DELETE: forgets the stored Zoho tokens (the synced employees stay). */
export async function DELETE() {
  return respond(async () => {
    const { writeZoho } = await import("@/app/lib/zoho/client");
    writeZoho({ refreshToken: undefined, accessToken: undefined, expiresAt: undefined, connectedAt: undefined });
    return { disconnected: true };
  }, OWNER);
}
