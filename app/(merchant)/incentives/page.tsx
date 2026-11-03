import type { Metadata } from "next";
import { IncentivesView } from "@/app/components/merchant/views/IncentivesView";

export const metadata: Metadata = { title: "Incentives · PayCrew" };

export default function Page() {
  return <IncentivesView />;
}
