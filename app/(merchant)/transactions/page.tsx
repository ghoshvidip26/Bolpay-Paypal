import type { Metadata } from "next";
import { TransactionsView } from "@/app/components/merchant/views/TransactionsView";

export const metadata: Metadata = { title: "Transactions · PayCrew" };

export default function Page() {
  return <TransactionsView />;
}
