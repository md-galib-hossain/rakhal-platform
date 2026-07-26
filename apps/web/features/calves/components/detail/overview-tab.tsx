"use client"; // no live query — the parent sheet already fetched the full CalfDetail

import { useTranslations } from "next-intl";
import { StatCard } from "@/components/shared/stat-card";
import { DateText } from "@/components/shared/date-text";
import type { CalfDetail } from "../../types";

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diffMs = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/** Overview tab (RFE-033, no Figma frame) — pure presentational, the single `GET /calves/:id`
 * fetch already returned everything needed. */
export function OverviewTab({ data }: { data: CalfDetail }) {
  const t = useTranslations("calves.detail.overview");
  const latestAdg = data.weightRecords.at(-1)?.adgToDate ?? null;
  const daysToWean = daysUntil(data.weaningTargetDate);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("birthWeight")}
          value={data.birthWeightKg != null ? t("kg", { value: data.birthWeightKg }) : "—"}
        />
        <StatCard
          label={t("currentWeight")}
          value={
            data.weightRecords.length > 0
              ? t("kg", { value: data.weightRecords.at(-1)!.weightKg })
              : "—"
          }
        />
        <StatCard label={t("adg")} value={latestAdg != null ? t("kgPerDay", { value: latestAdg }) : "—"} />
        <StatCard
          label={t("daysToWeaning")}
          value={daysToWean != null ? t("daysValue", { value: daysToWean }) : "—"}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1 rounded-xl border border-border p-3">
          <p className="text-xs text-muted-foreground">{t("birthEase")}</p>
          <p className="text-sm font-medium text-foreground">{data.birthEaseScore ?? "—"}</p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-border p-3">
          <p className="text-xs text-muted-foreground">{t("weaningTarget")}</p>
          <p className="text-sm font-medium text-foreground">
            {data.weaningTargetDate ? <DateText date={data.weaningTargetDate} /> : "—"}
            {" · "}
            {t("weaningWeightTarget", { value: data.weaningWeightTargetKg })}
          </p>
        </div>
      </div>
    </div>
  );
}
