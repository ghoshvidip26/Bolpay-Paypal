import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRole } from "@/app/lib/auth/dal";
import { PayoutsView } from "@/app/components/merchant/views/PayoutsView";
import { ContentSkeleton } from "@/app/components/Skeleton";

export const metadata: Metadata = { title: "Payout approvals · BolPay" };

export default function Page() {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <AuthedPayouts />
    </Suspense>
  );
}

async function AuthedPayouts() {
  await requireRole(["owner"]);
  return <PayoutsView />;
}
