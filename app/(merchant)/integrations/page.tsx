import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRole } from "@/app/lib/auth/dal";
import { ZohoView } from "@/app/components/merchant/views/ZohoView";
import { ContentSkeleton } from "@/app/components/Skeleton";

export const metadata: Metadata = { title: "Integrations · BolPay" };

export default function Page() {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <AuthedIntegrations />
    </Suspense>
  );
}

async function AuthedIntegrations() {
  await requireRole(["owner"]);
  return <ZohoView />;
}
