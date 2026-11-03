"use client";

import { useState } from "react";
import {
    PayPalProvider,
    PayPalOneTimePaymentButton,
    OnApproveDataOneTimePayments,
} from "@paypal/react-paypal-js/sdk-v6";
import { createOrder, captureOrder } from "@/app/actions";

// Wrap in PayPalProvider — this loads and initializes the SDK script
export default function PayPalCheckout() {
    const [orderComplete, setOrderComplete] = useState(false);

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
                createOrder={async () => {
                    const { id } = await createOrder();
                    return { orderId: id };
                }}
                onApprove={async ({ orderId }: OnApproveDataOneTimePayments) => {
                    await captureOrder(orderId);
                    setOrderComplete(true);
                }}
                presentationMode="auto"
            />
        </PayPalProvider>
    );
}