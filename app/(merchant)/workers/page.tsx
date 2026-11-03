import type { Metadata } from "next";
import { WorkersView } from "@/app/components/merchant/views/WorkersView";

export const metadata: Metadata = { title: "Workers · PayCrew" };

export default function Page() {
  return <WorkersView />;
}
