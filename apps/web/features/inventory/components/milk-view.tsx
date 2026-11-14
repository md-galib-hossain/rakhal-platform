"use client"; // dialog open state + tanks query

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Warehouse } from "lucide-react";
import { Button } from "@rakhal/ui/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { useMilkTanks } from "../hooks/use-inventory";
import { MilkTankCard } from "./milk-tank-card";
import { MilkTankFormDialog } from "./milk-tank-form-dialog";
import { MilkSyncDialog } from "./milk-sync-dialog";
import { MilkStatsCard } from "./milk-stats-card";
import { MilkAuditLogTable } from "./milk-audit-log-table";
import type { MilkTank } from "../types";

/**
 * Milk tab body — Figma "Inventory - Milk" (734:27903, `get_metadata` + `get_design_context` on
 * 734:27939/734:27983): "Physical Storage" tank grid + "Statistics" side card in one row, "Milk
 * Audit Log" table below. Grid/list view toggle from `InventoryTabs` doesn't apply here (the mock
 * has no grid-vs-table variant of this tab, only the tank-card layout), matching the ticket's own
 * scope note.
 */
export function MilkView() {
  const t = useTranslations("inventory.milk");
  const tanksQuery = useMilkTanks();
  const [formOpen, setFormOpen] = useState(false);
  const [editingTank, setEditingTank] = useState<MilkTank | undefined>(undefined);
  const [syncingTank, setSyncingTank] = useState<MilkTank | undefined>(undefined);

  const tanks = tanksQuery.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-6 rounded-2xl bg-card p-4 shadow-[0px_0px_3px_rgba(0,0,0,0.1)]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xl font-bold text-foreground">{t("physicalStorage")}</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditingTank(undefined);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden />
              {t("addNewTank")}
            </Button>
          </div>

          {tanksQuery.isError ? (
            <ErrorState onRetry={() => void tanksQuery.refetch()} />
          ) : !tanksQuery.isLoading && tanks.length === 0 ? (
            <EmptyState
              icon={Warehouse}
              title={t("empty.title")}
              description={t("empty.description")}
              action={
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setEditingTank(undefined);
                    setFormOpen(true);
                  }}
                >
                  {t("addNewTank")}
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {tanks.map((tank) => (
                <MilkTankCard key={tank.id} tank={tank} onSync={setSyncingTank} />
              ))}
              <button
                type="button"
                onClick={() => {
                  setEditingTank(undefined);
                  setFormOpen(true);
                }}
                className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Plus className="size-6" aria-hidden />
                <span className="text-sm font-medium">{t("addNewTank")}</span>
              </button>
            </div>
          )}
        </div>

        <MilkStatsCard tanks={tanks} />
      </div>

      <div className="flex flex-col gap-6 rounded-2xl bg-card p-4 shadow-[0px_0px_3px_rgba(0,0,0,0.1)]">
        <p className="text-xl font-bold text-foreground">{t("auditLog.title")}</p>
        <MilkAuditLogTable />
      </div>

      <MilkTankFormDialog open={formOpen} onOpenChange={setFormOpen} tank={editingTank} />
      <MilkSyncDialog tank={syncingTank} onOpenChange={(open) => !open && setSyncingTank(undefined)} />
    </div>
  );
}
