import { pageSurface } from "@/components/directory/detail-list";

export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite" className={pageSurface}>
      <div className="h-8 w-48 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted motion-reduce:animate-none" />
      <div className="h-64 animate-pulse rounded-xl bg-muted/60 motion-reduce:animate-none" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
