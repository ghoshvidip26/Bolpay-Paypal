import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRole } from "@/app/lib/auth/dal";
import { TransactionsView } from "@/app/components/merchant/views/TransactionsView";
import { ContentSkeleton } from "@/app/components/Skeleton";

export const metadata: Metadata = { title: "Transactions · BolPay" };

export default function Page() {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <AuthedTransactions />
    </Suspense>
  );
}

async function AuthedTransactions() {
  await requireRole(["owner"]);
  return <TransactionsView />;
}
