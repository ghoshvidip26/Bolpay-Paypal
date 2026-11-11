import Link from "next/link";

/** Footer for pages outside the workspace: login, worker pay page, legal pages. */
export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-slate-500 ${className}`}>
      <span>© 2026 BolPay</span>
      <nav aria-label="Legal" className="flex gap-4">
        <Link href="/terms" className="hover:text-slate-900">Terms of Service</Link>
        <Link href="/privacy" className="hover:text-slate-900">Privacy Policy</Link>
      </nav>
    </footer>
  );
}
