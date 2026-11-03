"use client";

import { useState } from "react";
import {
    PayPalProvider,
    PayPalOneTimePaymentButton,
    OnApproveDataOneTimePayments,
} from "@paypal/react-paypal-js/sdk-v6";
import { captureOrder } from "@/app/actions";

// Wrap in PayPalProvider — this loads and initializes the SDK script
export default function PayPalCheckout({
    amount,
    userId,
}: {
    amount: number;
    userId: string;
}) {
    const [orderComplete, setOrderComplete] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Creates the order through our API route; the PayPal SDK then handles approval.
    async function createOrder(): Promise<{ orderId: string }> {
        setError(null);
        const res = await fetch("/api/paypal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order_price: amount, user_id: userId }),
        });
        const json = (await res.json().catch(() => null)) as {
            success?: boolean;
            message?: string;
            data?: { orderId?: string };
        } | null;
        if (!res.ok || !json?.success || !json.data?.orderId) {
            const message = json?.message ?? "Could not start checkout.";
            setError(message);
            throw new Error(message);
        }
        return { orderId: json.data.orderId };
    }

    // Show a confirmation message after a successful order
    if (orderComplete) {
        return (
            <div
                role="status"
                className="rounded-lg border border-green-500 bg-green-50 px-5 py-4 font-medium text-green-700"
            >
                ✓ Payment successful! Your order has been confirmed.
            </div>
        );
    }

    return (
        <PayPalProvider
            clientId={process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!}
            environment={
                (process.env.NEXT_PUBLIC_PAYPAL_ENVIRONMENT as
                    | "sandbox"
                    | "production") ?? "sandbox"
            }
            components={["paypal-payments"]}
            pageType="checkout"
        >
            <PayPalOneTimePaymentButton
                createOrder={createOrder}
                onApprove={async ({ orderId }: OnApproveDataOneTimePayments) => {
                    try {
                        await captureOrder(orderId);
                        setOrderComplete(true);
                    } catch {
                        setError("Payment was approved but could not be captured. Please contact support.");
                    }
                }}
                presentationMode="auto"
            />
            {error && (
                <p role="alert" className="mt-3 text-sm text-red-600">
                    {error}
                </p>
            )}
        </PayPalProvider>
    );
}