import type { Metadata } from "next";
import { DashboardView } from "@/app/components/merchant/views/DashboardView";

export const metadata: Metadata = { title: "Dashboard · BolPay" };

export default function Page() {
  return <DashboardView />;
}
