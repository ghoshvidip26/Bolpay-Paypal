import type { Metadata } from "next";
import { requireRole } from "@/app/lib/auth/dal";
import { TransactionsView } from "@/app/components/merchant/views/TransactionsView";

export const metadata: Metadata = { title: "Transactions · BolPay" };

export default async function Page() {
  await requireRole(["owner"]);
  return <TransactionsView />;
}
