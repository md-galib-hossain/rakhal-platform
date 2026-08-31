"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { CattleDetailSheet } from "../components/detail/cattle-detail-sheet";
import { CattleFormDialog } from "../components/cattle-form-dialog";
import { CattleDisposeDialog } from "../components/cattle-dispose-dialog";
import { CattleDeleteDialog } from "../components/cattle-delete-dialog";
import { RecordSaleDialog } from "@/features/sales/components/record-sale-wizard";
import { useCattleDetail } from "../hooks/use-cattle";
import type { CattleDetail, CattleListItem } from "../types";

interface CattleDetailModalContextValue {
  cattleId: string | null;
  isOpen: boolean;
  openCattleDetail: (id: string) => void;
  closeCattleDetail: () => void;
}

const CattleDetailModalContext = createContext<CattleDetailModalContextValue | null>(null);

export function CattleDetailModalProvider({ children }: { children: React.ReactNode }) {
  const [viewId, setViewId] = useQueryState("view", parseAsString);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [disposeTarget, setDisposeTarget] = useState<CattleListItem | CattleDetail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CattleListItem | CattleDetail | null>(null);
  const [saleTarget, setSaleTarget] = useState<CattleListItem | CattleDetail | null>(null);

  const editingDetail = useCattleDetail(editingId);

  const openCattleDetail = useCallback(
    (id: string) => {
      void setViewId(id);
    },
    [setViewId],
  );

  const closeCattleDetail = useCallback(() => {
    void setViewId(null);
  }, [setViewId]);

  return (
    <CattleDetailModalContext.Provider
      value={{
        cattleId: viewId,
        isOpen: Boolean(viewId),
        openCattleDetail,
        closeCattleDetail,
      }}
    >
      {children}

      <CattleDetailSheet
        cattleId={viewId ?? undefined}
        onOpenChange={(open) => !open && closeCattleDetail()}
        onEdit={(cattle) => {
          closeCattleDetail();
          setEditingId(cattle.id);
          setFormOpen(true);
        }}
        onDispose={(cattle) => {
          closeCattleDetail();
          setDisposeTarget(cattle);
        }}
        onDelete={(cattle) => {
          closeCattleDetail();
          setDeleteTarget(cattle);
        }}
      />

      <CattleFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingId(undefined);
        }}
        cattle={editingDetail.data}
        loading={Boolean(editingId) && !editingDetail.data}
      />

      <CattleDisposeDialog
        open={disposeTarget !== null}
        onOpenChange={(open) => !open && setDisposeTarget(null)}
        cattle={disposeTarget as CattleListItem | null}
        onRequestSale={(item) => setSaleTarget(item)}
      />

      <RecordSaleDialog
        open={saleTarget !== null}
        onOpenChange={(open) => !open && setSaleTarget(null)}
        initial={
          saleTarget
            ? {
                type: "ANIMAL",
                cattleId: saleTarget.id,
                cattleLabel: `${saleTarget.tagNumber}${saleTarget.name ? ` — ${saleTarget.name}` : ""}`,
              }
            : undefined
        }
      />

      <CattleDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        cattle={deleteTarget as CattleListItem | null}
      />
    </CattleDetailModalContext.Provider>
  );
}

export function useCattleDetailModal(): CattleDetailModalContextValue {
  const context = useContext(CattleDetailModalContext);
  if (!context) {
    throw new Error("useCattleDetailModal must be used within a CattleDetailModalProvider");
  }
  return context;
}
