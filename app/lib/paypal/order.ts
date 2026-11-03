import { OrdersController, CheckoutPaymentIntent } from "@paypal/paypal-server-sdk";
import { paypalClient } from "./client";

const ordersController = new OrdersController(paypalClient)

export async function createPayPalOrder(amount: string): Promise<string> {
    const { result } = await ordersController.createOrder({
        body: {
            intent: CheckoutPaymentIntent.Capture,
            purchaseUnits: [
                {
                    amount: {
                        currencyCode: "USD",
                        value: amount
                    }
                }
            ]
        }
    })
    if (!result.id) {
        throw new Error("PayPal order creation failed: missing order ID")
    }
    return result.id
}

export async function capturePayPalOrder(orderId: string): Promise<unknown> {
    const { result } = await ordersController.captureOrder({ id: orderId });
    return result;
}