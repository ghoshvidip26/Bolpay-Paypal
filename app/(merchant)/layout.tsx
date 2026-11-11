import { Suspense } from "react";
import { Shell } from "@/app/components/merchant/Shell";
import { PageLoading } from "@/app/components/PageLoading";
import { requireRole } from "@/app/lib/auth/dal";

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  // The session is read at request time, so it streams in behind Suspense (Cache Components).
  return (
    <Suspense fallback={<PageLoading />}>
      <AuthedShell>{children}</AuthedShell>
    </Suspense>
  );
}

async function AuthedShell({ children }: { children: React.ReactNode }) {
  const session = await requireRole(["owner", "supervisor"]);
  return (
    <Shell
      viewer={{
        displayName: session.displayName,
        role: session.role === "owner" ? "owner" : "supervisor",
        businessName: session.business.name,
      }}
    >
      {children}
    </Shell>
  );
}
