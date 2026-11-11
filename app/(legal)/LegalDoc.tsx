import type { ReactNode } from "react";

export function LegalDoc({ title, updated, intro, children }: { title: string; updated: string; intro: ReactNode; children: ReactNode }) {
  return (
    <article className="text-sm leading-6 text-slate-700">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-1 text-xs text-slate-500">Last updated {updated}</p>
      <div className="mt-6 max-w-[68ch] space-y-3">{intro}</div>
      <div className="mt-8 max-w-[68ch] space-y-8">{children}</div>
    </article>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 marker:text-slate-400">{children}</ul>;
}
