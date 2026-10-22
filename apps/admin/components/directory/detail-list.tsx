import type { ReactNode } from "react";

/** Whole-page card, same chrome as the shared `PageCard`; detail pages use it because their header carries breadcrumbs and actions. */
export const pageSurface = "flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5";

export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border p-4">
      <h2 className="mb-3 text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

/** Label/value pairs as a semantic description list. */
export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(({ label, value }) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="break-words text-sm text-foreground">{value ?? "-"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Horizontally scrollable table shell so wide tables never force the page to scroll sideways. */
export function TableShell({ children, caption }: { children: ReactNode; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[640px] text-left text-sm [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-muted/50">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

/** Header and cell classes match the shared `TableHead` / `TableCell` so these tables read like the infinite lists. */
export const th = "h-11 whitespace-nowrap px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground";
export const td = "px-4 py-3 align-top";
