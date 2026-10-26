"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimalLink } from "@/components/shared/animal-link";
import { Pagination } from "@/components/shared/pagination";
import { formatDateTime } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { cn } from "@/lib/utils";
import { useTreatmentLogsPagedList } from "../hooks/use-health";
import type { HealthCareType, TreatmentLogListItem } from "../types";

const PURPOSE_FILTERS = ["all", "PREVENTIVE", "CURATIVE"] as const;
type PurposeFilter = (typeof PURPOSE_FILTERS)[number];

export function TreatmentHistorySection({ search }: { search: string }) {
  const t = useTranslations("health.treatmentHistory");
  const [careTypeFilter, setCareTypeFilter] = useState<PurposeFilter>("all");

  const list = useTreatmentLogsPagedList({
    search: search || undefined,
    careType: careTypeFilter === "all" ? undefined : (careTypeFilter as HealthCareType),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-muted p-1">
          {PURPOSE_FILTERS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setCareTypeFilter(key)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                careTypeFilter === key ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`filter.${key}`)}
            </button>
          ))}
        </div>
      </div>

      <TreatmentHistoryTable
        items={list.items}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => void list.refetch()}
      />

      {list.totalPages > 1 ? (
        <Pagination
          page={list.page}
          totalPages={list.totalPages}
          onPageChange={list.goToPage}
          isFetching={list.isFetching}
          pageSize={list.pageSize}
          onPageSizeChange={list.setPageSize}
        />
      ) : null}
    </div>
  );
}

export function TreatmentHistoryTable({
  items,
  isLoading,
  isError,
  onRetry,
}: {
  items: TreatmentLogListItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations("health.treatmentHistory");
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
    <>
      {/* Desktop view */}
      <div className="hidden overflow-x-auto rounded-2xl border border-border md:block">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead className="bg-muted">
            <tr>
              {["date", "animal", "purpose", "medicine", "dose", "route", "administeredBy", "notes"].map((col) => (
                <th key={col} className="h-[54px] px-3 text-left text-sm font-medium text-muted-foreground">
                  {t(`columns.${col}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isCurative = item.healthCase?.careType === "CURATIVE";
              const doseText = item.doseAmount ? `${item.doseAmount} ${item.doseUnit ?? ""}`.trim() : "—";
              return (
                <tr key={item.id} className="border-t border-border align-middle">
                  <td className="whitespace-nowrap px-3 py-3 text-sm text-foreground">
                    {formatDateTime(item.administeredAt, locale)}
                  </td>
                  <td className="px-3 py-3">
                    <AnimalLink
                      id={item.cattle.id}
                      animalName={item.cattle.name}
                      tagNumber={item.cattle.tagNumber}
                      className="group flex items-center gap-2 text-left font-normal"
                    >
                      <Avatar className="size-8">
                        {item.cattle.image ? <AvatarImage src={item.cattle.image} alt="" /> : null}
                        <AvatarFallback>{(item.cattle.name ?? item.cattle.tagNumber).slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <p className="text-sm font-medium text-foreground group-hover:underline">
                          {item.cattle.name ?? item.cattle.tagNumber}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.cattle.tagNumber}</p>
                      </div>
                    </AnimalLink>
                  </td>
                  <td className="px-3 py-3">
                    {isCurative ? (
                      <Chip variant="warning" subtle className="gap-1">
                        {t("purposes.CURATIVE")}
                      </Chip>
                    ) : (
                      <Chip variant="teal" subtle className="gap-1">
                        {t("purposes.PREVENTIVE")}
                      </Chip>
                    )}
                  </td>
                  <td className="px-3 py-3 font-medium text-foreground">{item.medicineName || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{doseText}</td>
                  <td className="px-3 py-3 text-muted-foreground">{item.route || "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">{item.administeredBy || "—"}</td>
                  <td className="max-w-[200px] truncate px-3 py-3 text-muted-foreground" title={item.notes ?? ""}>
                    {item.notes || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile view */}
      <div className="flex flex-col gap-3 md:hidden">
        {items.map((item) => {
          const isCurative = item.healthCase?.careType === "CURATIVE";
          const doseText = item.doseAmount ? `${item.doseAmount} ${item.doseUnit ?? ""}`.trim() : "";
          return (
            <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <AnimalLink
                  id={item.cattle.id}
                  animalName={item.cattle.name}
                  tagNumber={item.cattle.tagNumber}
                  className="flex items-center gap-2"
                >
                  <Avatar className="size-8">
                    {item.cattle.image ? <AvatarImage src={item.cattle.image} alt="" /> : null}
                    <AvatarFallback>{(item.cattle.name ?? item.cattle.tagNumber).slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-foreground">{item.cattle.name ?? item.cattle.tagNumber}</p>
                    <p className="text-xs text-muted-foreground">{item.cattle.tagNumber}</p>
                  </div>
                </AnimalLink>
                {isCurative ? (
                  <Chip variant="warning" subtle>
                    {t("purposes.CURATIVE")}
                  </Chip>
                ) : (
                  <Chip variant="teal" subtle>
                    {t("purposes.PREVENTIVE")}
                  </Chip>
                )}
              </div>

              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span className="font-medium text-foreground">{item.medicineName || "—"}</span>
                  <span>{doseText} {item.route ? `(${item.route})` : ""}</span>
                </div>
                <div className="flex justify-between">
                  <span>{formatDateTime(item.administeredAt, locale)}</span>
                  <span>{item.administeredBy}</span>
                </div>
                {item.notes ? (
                  <p className="mt-1 rounded-md bg-muted/50 p-1.5 text-xs italic text-muted-foreground">
                    {item.notes}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
