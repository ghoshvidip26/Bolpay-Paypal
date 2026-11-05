import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/app/lib/paypal/payouts";
import { applyWebhookItem } from "@/app/lib/server/service";

interface PayoutItemEvent {
  id?: string;
  event_type?: string;
  resource?: {
    payout_item_id?: string;
    transaction_status?: string;
    payout_item?: { sender_item_id?: string };
    errors?: { message?: string };
  };
}

/**
 * POST /api/webhooks/paypal
 * Receives PAYMENT.PAYOUTS-ITEM.* events. The signature is verified with PayPal before anything is trusted.
 * Register this URL under your sandbox app's webhooks and put the webhook id in PAYPAL_WEBHOOK_ID.
 */
export async function POST(req: Request) {
  let event: PayoutItemEvent;
  try {
    event = (await req.json()) as PayoutItemEvent;
  } catch {
    return NextResponse.json({ error: "Malformed body" }, { status: 400 });
  }

  const valid = await verifyWebhookSignature(
    {
      authAlgo: req.headers.get("paypal-auth-algo"),
      certUrl: req.headers.get("paypal-cert-url"),
      transmissionId: req.headers.get("paypal-transmission-id"),
      transmissionSig: req.headers.get("paypal-transmission-sig"),
      transmissionTime: req.headers.get("paypal-transmission-time"),
    },
    event,
  );
  if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

  if (event.event_type?.startsWith("PAYMENT.PAYOUTS-ITEM.")) {
    const r = event.resource;
    const payoutId = r?.payout_item?.sender_item_id;
    if (payoutId) {
      // Idempotent: replaying the same event just re-applies the same status.
      applyWebhookItem({
        payoutId,
        transactionStatus: r?.transaction_status,
        paypalItemId: r?.payout_item_id,
        error: r?.errors?.message,
      });
    }
  }
  return NextResponse.json({ received: true });
}
