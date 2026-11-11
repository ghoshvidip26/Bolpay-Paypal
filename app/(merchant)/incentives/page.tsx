import type { Metadata } from "next";
import { requireRole } from "@/app/lib/auth/dal";
import { IncentivesView } from "@/app/components/merchant/views/IncentivesView";

export const metadata: Metadata = { title: "Incentives · BolPay" };

export default async function Page() {
  await requireRole(["owner"]);
  return <IncentivesView />;
}
