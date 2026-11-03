import PayPalCheckout from "@/app/components/PayPalCheckout";

const PRICE = 9.99;
// No auth yet: replace with the signed-in user's id once login exists.
const GUEST_USER_ID = "guest";

export default function ProductPage() {
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-2 text-2xl font-bold">Developer Hoodie</h1>
      <p className="mb-1 text-gray-600">
        The only hoodie with a PayPal logo on the back.
      </p>
      <p className="mb-6 text-xl font-semibold">${PRICE.toFixed(2)}</p>

      {/* Add your product image here */}
      <div className="mb-6 h-48 w-full rounded bg-gray-100" />

      <PayPalCheckout amount={PRICE} userId={GUEST_USER_ID} />
    </main>
  );
}