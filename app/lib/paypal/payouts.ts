import "server-only";
import { paypalFetch } from "./rest";

export type ItemStatus = "processing" | "completed" | "failed";

export interface PayoutItemInput {
  /** Our payout id; sent as sender_item_id so PayPal results map back to it. */
  payoutId: string;
  email: string;
  amount: number;
  note?: string;
}

export interface PayoutItemResult {
  payoutId: string;
  paypalItemId?: string;
  status: ItemStatus;
  error?: string;
}

/** Maps PayPal's transaction_status values onto our three display states. */
export function mapTransactionStatus(s: string | undefined): ItemStatus {
  switch (s) {
    case "SUCCESS":
      return "completed";
    case "FAILED":
    case "RETURNED":
    case "REFUNDED":
    case "REVERSED":
    case "BLOCKED":
    case "DENIED":
    case "CANCELED":
      return "failed";
    // PENDING, ONHOLD, UNCLAIMED: not settled yet.
    default:
      return "processing";
  }
}

interface BatchResponse {
  batch_header: { payout_batch_id: string; batch_status: string };
}

export async function createPayoutBatch(args: {
  senderBatchId: string;
  currency: string;
  items: PayoutItemInput[];
}): Promise<{ batchId: string }> {
  const res = await paypalFetch<BatchResponse>("/v1/payments/payouts", {
    method: "POST",
    requestId: args.senderBatchId,
    body: {
      sender_batch_header: {
        sender_batch_id: args.senderBatchId,
        email_subject: "You have a payout from BolPay",
        email_message: "Your incentive payout has been sent.",
      },
      items: args.items.map((i) => ({
        recipient_type: "EMAIL",
        receiver: i.email,
        amount: { value: i.amount.toFixed(2), currency: args.currency },
        note: i.note ?? "Incentive payout",
        sender_item_id: i.payoutId,
      })),
    },
  });
  return { batchId: res.batch_header.payout_batch_id };
}

interface BatchDetails {
  batch_header: { payout_batch_id: string; batch_status: string };
  items?: {
    payout_item_id: string;
    transaction_status: string;
    payout_item: { sender_item_id?: string };
    errors?: { message?: string };
  }[];
}

export async function getPayoutBatch(batchId: string): Promise<{ batchStatus: string; items: PayoutItemResult[] }> {
  const res = await paypalFetch<BatchDetails>(`/v1/payments/payouts/${encodeURIComponent(batchId)}?page_size=100`);
  return {
    batchStatus: res.batch_header.batch_status,
    items: (res.items ?? [])
      .filter((i) => i.payout_item.sender_item_id)
      .map((i) => ({
        payoutId: i.payout_item.sender_item_id!,
        paypalItemId: i.payout_item_id,
        status: mapTransactionStatus(i.transaction_status),
        error:
          i.errors?.message ??
          (i.transaction_status === "UNCLAIMED" ? "Recipient has no PayPal account yet (unclaimed)" : undefined),
      })),
  };
}

export interface WebhookHeaders {
  authAlgo: string | null;
  certUrl: string | null;
  transmissionId: string | null;
  transmissionSig: string | null;
  transmissionTime: string | null;
}

/** Asks PayPal to verify a webhook's signature. Returns false on any failure. */
export async function verifyWebhookSignature(h: WebhookHeaders, event: unknown): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId || !h.authAlgo || !h.certUrl || !h.transmissionId || !h.transmissionSig || !h.transmissionTime) {
    return false;
  }
  try {
    const res = await paypalFetch<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", {
      method: "POST",
      body: {
        auth_algo: h.authAlgo,
        cert_url: h.certUrl,
        transmission_id: h.transmissionId,
        transmission_sig: h.transmissionSig,
        transmission_time: h.transmissionTime,
        webhook_id: webhookId,
        webhook_event: event,
      },
    });
    return res.verification_status === "SUCCESS";
  } catch {
    return false;
  }
}
