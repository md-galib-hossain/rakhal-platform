"use client"; // row actions open the Case Management sheet

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/constants/i18n";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { diagnosisChipVariant, formatDoseWhen } from "../format";
import { ProgressRing } from "./progress-ring";
import type { HealthCaseListItem } from "../types";

/** Figma "Health Management Center" table — Sick Bay tab (node 734:35802): Name (avatar+tag) / Shed
 * / Diagnosis (chip) / Treatment / Progress (X/total ring) / Next Dose / Action. Backed by the real
 * `GET /health/sick-bay` (`health.service.ts#getSickBay`) — `Treatment` has no dedicated backend
 * field, so it's derived from the linked `healthPlan.name` + step count (falls back to "—" when no
 * plan is applied yet, same as the Figma mock's own "-" rows for unplanned cases). */
export function SickBayTable({
  items,
  isLoading,
  isError,
  onRetry,
  onManageCase,
}: {
  items: HealthCaseListItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onManageCase: (caseId: string) => void;
}) {
  const t = useTranslations("health.sickBay");
  const locale = useLocale() as Locale;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-md" />
        ))}
      </div>
    );
  }
  if (isError) return <ErrorState description={t("error")} onRetry={onRetry} />;
  if (items.length === 0) return <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead className="bg-muted">
          <tr>
            {["name", "shed", "diagnosis", "treatment", "progress", "nextDose", "action"].map((col) => (
              <th key={col} className="h-[54px] px-2 text-left text-sm font-medium text-muted-foreground">
                {t(`columns.${col}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const nextTask = item.tasks[0];
            const dose = nextTask ? formatDoseWhen(nextTask.dueDateTime, locale, t("today"), t("tomorrow")) : null;
            const treatment = item.healthPlan
              ? `${item.healthPlan.name}${item.totalSteps ? `, ${item.totalSteps}` : ""}`
              : "—";
            return (
              <tr key={item.id} className="border-t border-border">
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-8">
                      {item.cattle.image ? <AvatarImage src={item.cattle.image} alt="" /> : null}
                      <AvatarFallback>{(item.cattle.name ?? item.cattle.tagNumber).slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <p className="text-sm font-medium text-foreground">{item.cattle.name ?? item.cattle.tagNumber}</p>
                      <p className="text-xs text-muted-foreground">{item.cattle.tagNumber}</p>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2 text-sm text-foreground">{item.shedName ?? "—"}</td>
                <td className="px-2 py-2">
                  <Chip variant={diagnosisChipVariant(item.diagnosis)}>{item.diagnosis}</Chip>
                </td>
                <td className="max-w-[180px] truncate px-2 py-2 text-sm text-foreground">{treatment}</td>
                <td className="px-2 py-2">
                  {item.totalSteps > 0 ? (
                    <div className="flex items-center gap-1">
                      <p className="text-sm text-foreground">
                        {item.currentStep}
                        <span className="text-muted-foreground">/{item.totalSteps}</span>
                      </p>
                      <ProgressRing value={item.progressPercentage} />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-2 py-2">
                  {dose ? (
                    <div className="flex flex-col">
                      <p className="text-sm text-foreground">{dose.day}</p>
                      <p className="text-xs text-muted-foreground">{dose.time}</p>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-2 py-2">
                  <Button variant="outline" size="sm" onClick={() => onManageCase(item.id)}>
                    {t("manageCase")}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
