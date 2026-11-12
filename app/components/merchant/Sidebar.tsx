"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconApprove, IconAttendance, IconIntegrations, IconLedger, IconOverview, IconSettings, IconTiers, IconWorkers } from "../icons";
import { WorkspaceSwitch } from "./WorkspaceSwitch";

type Role = "owner" | "supervisor";

const OWNER_ONLY = new Set(["/incentives", "/payouts", "/transactions", "/integrations"]);

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: IconOverview },
  { href: "/workers", label: "Workers", Icon: IconWorkers },
  { href: "/attendance", label: "Attendance", Icon: IconAttendance },
  { href: "/incentives", label: "Incentives", Icon: IconTiers },
  { href: "/payouts", label: "Payout approvals", Icon: IconApprove },
  { href: "/transactions", label: "Transactions", Icon: IconLedger },
  { href: "/integrations", label: "Integrations", Icon: IconIntegrations },
  { href: "/settings", label: "Settings", Icon: IconSettings },
];

export function Sidebar({ role, pendingCount }: { role: Role; pendingCount: number }) {
  const pathname = usePathname();
  return (
    <>
      <nav aria-label="Main" className="flex gap-0.5 overflow-x-auto md:flex-col">
        {NAV.filter((item) => role === "owner" || !OWNER_ONLY.has(item.href)).map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                active ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className={`size-4 ${active ? "text-teal-700" : "text-slate-400"}`} />
              {label}
              {href === "/payouts" && pendingCount > 0 && (
                <span className="ml-auto rounded border border-slate-200 bg-white px-1.5 text-[10px] font-semibold leading-4 text-slate-700 tabular-nums" aria-label={`${pendingCount} waiting`}>
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <WorkspaceSwitch />
    </>
  );
}
