import type { Metadata } from "next";
import { PayoutsView } from "@/app/components/merchant/views/PayoutsView";

export const metadata: Metadata = { title: "Payout approvals · PayCrew" };

export default function Page() {
  return <PayoutsView />;
}
