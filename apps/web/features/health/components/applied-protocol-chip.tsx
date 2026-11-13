import { ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "@rakhal/ui/ui/chip";

/** RFE-136 / EPIC D8 — the one way an applied protocol is shown wherever an animal or round is listed (Sick Bay row,
 * preventive round, the cow's Health tab): the protocol's name with, when known, how far along it is. Rendered as a
 * chip so it reads as a label on the row, not as more text to parse. */
export function AppliedProtocolChip({
  name,
  current,
  total,
  className,
}: {
  name: string;
  /** Steps done so far; shown as "2/5" together with `total`. */
  current?: number;
  total?: number;
  className?: string;
}) {
  const showProgress = typeof current === "number" && typeof total === "number" && total > 0;
  return (
    <Chip variant="indigo" className={cn("max-w-full gap-1.5", className)} title={name}>
      <ClipboardList className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{name}</span>
      {showProgress ? (
        <span className="shrink-0 font-semibold tabular-nums">
          {current}/{total}
        </span>
      ) : null}
    </Chip>
  );
}
