import Link from "next/link";
import { Brand } from "@/app/components/icons";
import { SiteFooter } from "@/app/components/SiteFooter";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-3.5">
          <Link href="/" aria-label="BolPay home">
            <Brand />
          </Link>
          <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Back to app
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">{children}</main>
      <div className="mx-auto w-full max-w-3xl px-5 pb-6">
        <SiteFooter className="border-t border-slate-200 pt-5" />
      </div>
    </div>
  );
}
