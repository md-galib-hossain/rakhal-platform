"use client"; // live query + sheet state

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRightToLine, Circle, CircleCheck } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { useProtocol } from "../../hooks/use-reproduction";
import type { ProtocolSummary } from "../../types";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Read-only step-by-step view of a protocol template (RAKHAL-214 follow-up, no ticket # — user
 * asked why clicking a system-default protocol card showed nothing). Distinct from
 * `ProtocolInstanceTimeline`: that one zips a template's steps to one cow's actual Task-Hub tasks
 * (real dates, done/overdue status); this one has no cow/instance yet, so it just renders the
 * template's own `day_number`/`title`/`instruction` plan plus its farm-wide metrics. */
export function ProtocolDetailSheet({
  protocol,
  open,
  onOpenChange,
  startDate,
}: {
  protocol: ProtocolSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set (Apply Protocol dialog's own start-date field), steps show real calendar dates
   * instead of "Day N" — same `addDays(start, day_number)` formula the backend/instance timeline
   * use, but there's no task/instance yet so it's a projection, not an actual due date. */
  startDate?: string;
}) {
  const t = useTranslations("reproduction.protocols");
  const locale = useLocale() as Locale;
  const detail = useProtocol(protocol?.id);

  const items: TimelineItem[] = useMemo(() => {
    if (!detail.data) return [];
    const start = startDate ? new Date(startDate) : null;
    return [...detail.data.steps]
      .sort((a, b) => a.day_number - b.day_number)
      .map((step) => ({
        id: `${step.day_number}-${step.title}`,
        icon: step.is_required ? <CircleCheck className="size-3.5" aria-hidden /> : <Circle className="size-3.5" aria-hidden />,
        tone: step.is_required ? "primary" : "muted",
        title: step.title,
        subtitle: step.instruction ?? undefined,
        date: start ? formatDate(addDays(start, step.day_number), locale) : t("detail.dayLabel", { value: step.day_number }),
      }));
  }, [detail.data, t, startDate, locale]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open && protocol ? (
        <SheetContent
          showClose={false}
          className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[560px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[560px]"
        >
          <div className="flex items-center justify-between pb-3">
            <SheetTitle className="text-xl font-bold text-foreground">{protocol.name}</SheetTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label={t("detail.close")}
              className="flex size-5 items-center justify-center text-foreground transition-opacity hover:opacity-70"
            >
              <ArrowRightToLine className="size-5" aria-hidden />
            </button>
          </div>

          <p className="pb-3 text-xs text-muted-foreground">{t("durationDays", { value: protocol.duration_days })}</p>

          <div className="flex flex-wrap items-center gap-2 pb-4 text-xs">
            <span className="rounded-full bg-info-tint px-2 py-0.5 font-medium text-info">
              {t("applied", { value: protocol.metrics.applied })}
            </span>
            <span className="rounded-full bg-warning-tint px-2 py-0.5 font-medium text-warning">
              {t("inProgress", { value: protocol.metrics.in_progress })}
            </span>
            <span className="rounded-full bg-success-tint px-2 py-0.5 font-medium text-success">
              {t("conceptionRate", { value: protocol.metrics.conception_rate ?? "—" })}
            </span>
          </div>

          <div className="border-t border-dashed border-border" />

          <div className="flex-1 overflow-y-auto py-4">
            {detail.isLoading ? (
              <CardSkeleton lines={4} />
            ) : detail.isError ? (
              <ErrorState description={t("error")} onRetry={() => detail.refetch()} />
            ) : (
              <>
                {detail.data?.description ? (
                  <p className="pb-4 text-sm text-muted-foreground">{detail.data.description}</p>
                ) : null}
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("detail.noSteps")}</p>
                ) : (
                  <Timeline items={items} />
                )}
              </>
            )}
          </div>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}
