"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10" },
  { href: "/workers", label: "Workers", icon: "M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21a8 8 0 0116 0" },
  { href: "/attendance", label: "Attendance", icon: "M8 2v4M16 2v4M3 9h18M5 5h14a2 2 0 012 2v13a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2zM9 15l2 2 4-4" },
  { href: "/incentives", label: "Incentives", icon: "M12 2l3 7h7l-5.5 4.5L18.5 21 12 17l-6.5 4 2-7.5L2 9h7z" },
  { href: "/payouts", label: "Payout approvals", icon: "M5 13l4 4L19 7" },
  { href: "/transactions", label: "Transactions", icon: "M7 7h13l-3-3M17 17H4l3 3" },
];

export function Sidebar({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto md:flex-col">
      {NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={item.icon} />
            </svg>
            {item.label}
            {item.href === "/payouts" && pendingCount > 0 && (
              <span className="ml-auto rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-800">{pendingCount}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
