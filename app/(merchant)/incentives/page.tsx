import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRole } from "@/app/lib/auth/dal";
import { IncentivesView } from "@/app/components/merchant/views/IncentivesView";
import { ContentSkeleton } from "@/app/components/Skeleton";

export const metadata: Metadata = { title: "Incentives · BolPay" };

export default function Page() {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <AuthedIncentives />
    </Suspense>
  );
}

async function AuthedIncentives() {
  await requireRole(["owner"]);
  return <IncentivesView />;
}
