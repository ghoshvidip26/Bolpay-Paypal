import type { SVGProps } from "react";

/** Small line icons drawn on a 20px grid. Inherit color from the text. */
function Icon({ d, className = "size-4", ...rest }: { d: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className} {...rest}>
      <path d={d} />
    </svg>
  );
}

type P = Omit<SVGProps<SVGSVGElement>, "d">;

export const IconOverview = (p: P) => <Icon {...p} d="M3.5 3.5h5v7h-5zM11.5 3.5h5v4h-5zM11.5 10.5h5v6h-5zM3.5 13.5h5v3h-5z" />;
export const IconWorkers = (p: P) => <Icon {...p} d="M7.5 9.5a2.75 2.75 0 100-5.5 2.75 2.75 0 000 5.5zM2.5 16.5c.5-2.7 2.5-4.25 5-4.25s4.5 1.55 5 4.25M13 4.2a2.75 2.75 0 010 5.1M14.6 12.4c1.5.5 2.5 1.9 2.9 4.1" />;
export const IconAttendance = (p: P) => <Icon {...p} d="M4.5 4.5h11a1 1 0 011 1v10a1 1 0 01-1 1h-11a1 1 0 01-1-1v-10a1 1 0 011-1zM3.5 8h13M7 2.75v3.5M13 2.75v3.5M7.5 12.25l1.75 1.75 3.25-3.5" />;
export const IconTiers = (p: P) => <Icon {...p} d="M3 16.5h14M4.5 16.5v-4h3v4M8.5 16.5v-8h3v8M12.5 16.5v-12h3v12" />;
export const IconApprove = (p: P) => <Icon {...p} d="M7 3.5h6v2.25H7zM13 4.5h1.5a1 1 0 011 1v10a1 1 0 01-1 1h-9a1 1 0 01-1-1v-10a1 1 0 011-1H7M7.5 11.25l1.75 1.75 3.25-3.5" />;
export const IconLedger = (p: P) => <Icon {...p} d="M4 7h12M13 4l3 3-3 3M16 13H4M7 10l-3 3 3 3" />;
export const IconSettings = (p: P) => (
  <Icon
    {...p}
    d="M8.22 4.17L8.47 2.15h3.06l.25 2.02a6.1 6.1 0 011.08.44l1.61-1.24 2.16 2.16-1.24 1.61a6.1 6.1 0 01.44 1.08l2.02.25v3.06l-2.02.25a6.1 6.1 0 01-.44 1.08l1.24 1.61-2.16 2.16-1.61-1.24a6.1 6.1 0 01-1.08.44l-.25 2.02H8.47l-.25-2.02a6.1 6.1 0 01-1.08-.44l-1.61 1.24-2.16-2.16 1.24-1.61a6.1 6.1 0 01-.44-1.08l-2.02-.25V8.47l2.02-.25a6.1 6.1 0 01.44-1.08L3.37 5.53l2.16-2.16 1.61 1.24a6.1 6.1 0 011.08-.44zM12.5 10a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
  />
);
export const IconChevron = (p: P) => <Icon {...p} d="M6.5 8l3.5 3.5L13.5 8" />;
export const IconSignOut = (p: P) => <Icon {...p} d="M8 3.5H5a1 1 0 00-1 1v11a1 1 0 001 1h3M12.5 13.5L16 10l-3.5-3.5M16 10H8" />;
export const IconDoc = (p: P) => <Icon {...p} d="M5.5 2.75h6l3 3v11a.5.5 0 01-.5.5h-8.5a.5.5 0 01-.5-.5V3.25a.5.5 0 01.5-.5zM11.5 2.75v3h3M7.5 10h5M7.5 13h5" />;
export const IconMic = (p: P) => <Icon {...p} d="M10 2.75a2.5 2.5 0 00-2.5 2.5v4.5a2.5 2.5 0 005 0v-4.5a2.5 2.5 0 00-2.5-2.5zM5 9.5a5 5 0 0010 0M10 14.5v2.75" />;
export const IconSpeaker = (p: P) => <Icon {...p} d="M9 4.5L5.5 7.5H3v5h2.5L9 15.5zM12.5 7.5a3.5 3.5 0 010 5M15 5a7 7 0 010 10" />;
export const IconSpeakerOff = (p: P) => <Icon {...p} d="M9 4.5L5.5 7.5H3v5h2.5L9 15.5zM13 8l4 4M17 8l-4 4" />;
export const IconClose = (p: P) => <Icon {...p} d="M5.5 5.5l9 9M14.5 5.5l-9 9" />;
export const IconAlert = (p: P) => <Icon {...p} d="M10 17.25a7.25 7.25 0 100-14.5 7.25 7.25 0 000 14.5zM10 6.5v4.25M10 13.5v.01" />;
export const IconInfo = (p: P) => <Icon {...p} d="M10 17.25a7.25 7.25 0 100-14.5 7.25 7.25 0 000 14.5zM10 9.25v4.5M10 6.5v.01" />;
export const IconDone = (p: P) => <Icon {...p} d="M10 17.25a7.25 7.25 0 100-14.5 7.25 7.25 0 000 14.5zM7 10.25l2 2 4-4.25" />;
export const IconEye = (p: P) => <Icon {...p} d="M1.75 10S4.75 4.5 10 4.5s8.25 5.5 8.25 5.5-3 5.5-8.25 5.5S1.75 10 1.75 10zM10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />;
export const IconEyeOff = (p: P) => <Icon {...p} d="M1.75 10S4.75 4.5 10 4.5s8.25 5.5 8.25 5.5-3 5.5-8.25 5.5S1.75 10 1.75 10zM10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM3.5 3.5l13 13" />;

/** BolPay mark: a short voice waveform ("bol" means "speak"). */
export function BrandMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" aria-hidden className={className}>
      <rect width="28" height="28" rx="6" className="fill-teal-700" />
      <g stroke="white" strokeWidth="2.25" strokeLinecap="round">
        <path d="M8 12.5v3M12 8.5v11M16 10.5v7M20 13v2" />
      </g>
    </svg>
  );
}

export function Brand({ sub }: { sub?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <BrandMark />
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight tracking-tight text-slate-900">BolPay</p>
        {sub && <p className="truncate text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}
