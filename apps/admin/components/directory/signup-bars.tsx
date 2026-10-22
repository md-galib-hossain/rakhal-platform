import type { DayCount } from "@/lib/api/directory";

/** Dependency-free bar chart: one bar per day, height relative to the busiest day, with a text alternative. */
export function SignupBars({ title, series }: { title: string; series: DayCount[] }) {
  const max = Math.max(1, ...series.map((d) => d.count));
  const total = series.reduce((sum, d) => sum + d.count, 0);
  return (
    <figure className="space-y-2">
      <figcaption className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-foreground">{title}</span>
        <span className="text-muted-foreground">{total} in {series.length} days</span>
      </figcaption>
      <div
        role="img"
        aria-label={`${title}: ${total} in the last ${series.length} days`}
        className="flex h-28 items-end gap-0.5 rounded-md bg-muted/50 p-2"
      >
        {series.map((d) => (
          <div
            key={d.day}
            title={`${d.day}: ${d.count}`}
            className="min-w-0 flex-1 rounded-sm bg-primary"
            style={{ height: `${d.count === 0 ? 2 : Math.max(6, (d.count / max) * 100)}%`, opacity: d.count === 0 ? 0.25 : 1 }}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{series[0]?.day}</span>
        <span>{series[series.length - 1]?.day}</span>
      </div>
    </figure>
  );
}
