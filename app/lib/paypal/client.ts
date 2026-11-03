import { Client, Environment } from "@paypal/paypal-server-sdk";
export const paypalClient = new Client({
    clientCredentialsAuthCredentials: {
        oAuthClientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!,
        oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET!
    },
    environment: process.env.NEXT_PUBLIC_PAYPAL_ENVIRONMENT === "production"
        ? Environment.Production
        : Environment.Sandbox,
})