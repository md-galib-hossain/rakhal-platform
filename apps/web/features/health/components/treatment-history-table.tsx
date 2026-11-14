"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@rakhal/ui/ui/avatar";
import { Chip } from "@rakhal/ui/ui/chip";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { AnimalLink } from "@/components/shared/animal-link";
import { Pagination } from "@/components/shared/pagination";
import { RowActionsMenu } from "@rakhal/ui/shared/row-actions-menu";
import { ConfirmDialog } from "@rakhal/ui/shared/confirm-dialog";
import { useCan } from "@/lib/auth/permissions";
import { ApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { cn } from "@/lib/utils";
import { parseAsString, useQueryState } from "nuqs";
import { useTreatmentLogsPagedList, useVoidTreatment } from "../hooks/use-health";
import type { HealthCareType, MedicineRoute, TreatmentLogListItem } from "../types";

export function TreatmentHistorySection({ search }: { search: string }) {
  const [careType] = useQueryState("careType", parseAsString);
  const [route] = useQueryState("route", parseAsString);

  const list = useTreatmentLogsPagedList({
    search: search || undefined,
    careType: (careType as HealthCareType) || undefined,
    route: (route as MedicineRoute) || undefined,
  });

  return (
    <div className="flex flex-col gap-3">
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
  const canUpdate = useCan()("healthcare.update");
  const voidTreatment = useVoidTreatment();
  const [voidTarget, setVoidTarget] = useState<TreatmentLogListItem | null>(null);

  async function handleConfirmVoid() {
    if (!voidTarget) return;
    try {
      await voidTreatment.mutateAsync({ id: voidTarget.id });
      toast.success(t("voidSuccess"));
      setVoidTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("voidError"));
    }
  }

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
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead className="bg-muted">
            <tr>
              {["date", "animal", "purpose", "medicine", "dose", "route", "administeredBy", "notes"].map((col) => (
                <th key={col} className="h-[54px] px-3 text-left text-sm font-medium text-muted-foreground">
                  {t(`columns.${col}`)}
                </th>
              ))}
              {canUpdate ? (
                <th className="h-[54px] px-3 text-right text-sm font-medium text-muted-foreground">
                  {t("columns.action")}
                </th>
              ) : null}
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
                  {canUpdate ? (
                    <td className="px-3 py-3 text-right">
                      <RowActionsMenu
                        menuLabel={t("moreActions")}
                        actions={[
                          {
                            key: "void",
                            label: t("voidAction"),
                            destructive: true,
                            onSelect: () => setVoidTarget(item),
                          },
                        ]}
                      />
                    </td>
                  ) : null}
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
                <div className="flex items-center gap-1">
                  {isCurative ? (
                    <Chip variant="warning" subtle>
                      {t("purposes.CURATIVE")}
                    </Chip>
                  ) : (
                    <Chip variant="teal" subtle>
                      {t("purposes.PREVENTIVE")}
                    </Chip>
                  )}
                  {canUpdate ? (
                    <RowActionsMenu
                      menuLabel={t("moreActions")}
                      actions={[
                        {
                          key: "void",
                          label: t("voidAction"),
                          destructive: true,
                          onSelect: () => setVoidTarget(item),
                        },
                      ]}
                    />
                  ) : null}
                </div>
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

      <ConfirmDialog
        open={voidTarget !== null}
        onOpenChange={(open) => !open && setVoidTarget(null)}
        title={t("voidDialog.title")}
        description={t("voidDialog.description", {
          animal: voidTarget?.cattle.name ?? voidTarget?.cattle.tagNumber ?? "",
        })}
        confirmLabel={t("voidDialog.confirm")}
        cancelLabel={t("voidDialog.cancel")}
        onConfirm={handleConfirmVoid}
      />
    </>
  );
}
