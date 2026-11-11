import type { Metadata } from "next";
import { requireRole } from "@/app/lib/auth/dal";
import { PayoutsView } from "@/app/components/merchant/views/PayoutsView";

export const metadata: Metadata = { title: "Payout approvals · BolPay" };

export default async function Page() {
  await requireRole(["owner"]);
  return <PayoutsView />;
}
