/** Placeholder shapes shown while data loads, laid out like the real pages. */

function Bone({ className = "" }: { className?: string }) {
  return <span className={`block animate-pulse rounded bg-slate-200/80 ${className}`} />;
}

const ROW_WIDTHS = ["w-40", "w-32", "w-44", "w-28", "w-36", "w-32", "w-40"];

export function ContentSkeleton({ stats = 4 }: { stats?: 3 | 4 }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading">
      <div className="mb-5">
        <Bone className="h-5 w-40" />
        <Bone className="mt-2 h-3 w-64" />
      </div>
      <div className={`grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 ${stats === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-3"}`}>
        {Array.from({ length: stats }, (_, i) => (
          <div key={i} className="bg-white px-4 py-3.5">
            <Bone className="h-3 w-20" />
            <Bone className="mt-2.5 h-5 w-24" />
            <Bone className="mt-2 h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <Bone className="h-3.5 w-32" />
        </div>
        {ROW_WIDTHS.map((w, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0">
            <Bone className="size-7 shrink-0 rounded-full" />
            <Bone className={`h-3 ${w}`} />
            <Bone className="ml-auto h-3 w-16" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}

/** Full-screen placeholder for the owner and supervisor workspace (sidebar + page). */
export function ShellSkeleton() {
  return (
    <div className="min-h-dvh bg-canvas md:grid md:grid-cols-[216px_minmax(0,1fr)]">
      <aside className="hidden border-r border-slate-200 bg-white md:block">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <Bone className="size-7 rounded-md" />
          <div>
            <Bone className="h-3 w-16" />
            <Bone className="mt-1.5 h-2.5 w-24" />
          </div>
        </div>
        <div className="space-y-1 px-3">
          {["w-20", "w-16", "w-20", "w-16", "w-24", "w-20"].map((w, i) => (
            <div key={i} className="flex items-center gap-2.5 px-2.5 py-2">
              <Bone className="size-4" />
              <Bone className={`h-3 ${w}`} />
            </div>
          ))}
        </div>
      </aside>
      <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-5 md:px-8 md:py-7">
        <ContentSkeleton />
      </main>
    </div>
  );
}

/** Placeholder for a worker's own pay page. */
export function WorkerSkeleton() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-5">
      <div className="mb-6 flex items-center gap-2.5">
        <Bone className="size-7 rounded-md" />
        <Bone className="h-3 w-20" />
      </div>
      <ContentSkeleton />
    </main>
  );
}
