import { NextResponse } from "next/server";
import { createPayPalOrder } from "@/app/lib/paypal/order";
import { guard, STAFF } from "@/app/lib/server/http";

/**
 * POST /api/paypal
 * Body: { order_price: number | string, user_id: string }
 * Creates a PayPal order (intent CAPTURE) and returns its id for the client SDK to approve.
 */
export async function POST(req: Request) {
  const denied = await guard(STAFF);
  if (denied) return denied;
    let body: { order_price?: unknown; user_id?: unknown };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ success: false, message: "Malformed JSON body" }, { status: 400 });
    }

    const price = Number(body.order_price);
    if (!body.user_id || typeof body.user_id !== "string" || !Number.isFinite(price) || price <= 0) {
        return NextResponse.json(
            { success: false, message: "Please provide a positive order_price and a user_id" },
            { status: 400 },
        );
    }

    try {
        // PayPal expects a string with at most 2 decimals.
        const orderId = await createPayPalOrder(price.toFixed(2));
        return NextResponse.json({ success: true, data: { orderId } });
    } catch (error) {
        console.error("PayPal order creation failed", error);
        return NextResponse.json({ success: false, message: "Could not create PayPal order" }, { status: 502 });
    }
}
