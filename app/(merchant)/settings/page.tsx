import type { Metadata } from "next";
import { SettingsView } from "@/app/components/merchant/views/SettingsView";

export const metadata: Metadata = { title: "Settings · BolPay" };

export default function Page() {
  return <SettingsView />;
}
