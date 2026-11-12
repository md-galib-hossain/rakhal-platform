import { cn } from "@/lib/utils";

/** Small ring gauge — Figma's sick-bay table "Progress" column graph (node "Graph", property
 * `Half40%Circle`) and the dashboard's Herd Health Score gauge use the same donut-ring shape, just
 * at different sizes; both render from a plain 0-100 value here (real `progressPercentage`/
 * `herdHealthScore`), not the Figma mock's baked-in image asset. */
export function ProgressRing({
  value,
  size = 16,
  strokeWidth = 3,
  className,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <span
      role="img"
      aria-label={`${Math.round(pct)}%`}
      className={cn("relative inline-block shrink-0 rounded-full", className)}
      style={{
        width: size,
        height: size,
        background: `conic-gradient(var(--color-primary) ${pct * 3.6}deg, var(--color-border) 0deg)`,
      }}
    >
      <span
        className="absolute inset-0 m-auto rounded-full bg-card"
        style={{ width: size - strokeWidth * 2, height: size - strokeWidth * 2 }}
      />
    </span>
  );
}
