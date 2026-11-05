import "server-only";

/**
 * Minimal PayPal REST client for APIs the SDK doesn't cover (Payouts, webhook verification).
 * Reuses the same credentials as ./client.ts.
 */
const IS_PRODUCTION = process.env.NEXT_PUBLIC_PAYPAL_ENVIRONMENT === "production";
export const PAYPAL_BASE_URL = IS_PRODUCTION ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
export const isLivePayPal = IS_PRODUCTION;

export class PayPalError extends Error {
  constructor(
    message: string,
    public status: number,
    public debugId?: string,
  ) {
    super(message);
  }
}

let cached: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const id = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new PayPalError("PayPal credentials are not configured", 500);

  const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new PayPalError("Could not authenticate with PayPal", res.status);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export async function paypalFetch<T>(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; requestId?: string } = {},
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_BASE_URL}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      // PayPal dedupes retries of the same request with this header.
      ...(init.requestId ? { "PayPal-Request-Id": init.requestId } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new PayPalError(
      typeof json.message === "string" ? json.message : `PayPal request failed (${res.status})`,
      res.status,
      typeof json.debug_id === "string" ? json.debug_id : undefined,
    );
  }
  return json as T;
}
