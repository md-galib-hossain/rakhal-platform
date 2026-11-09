"use client";

import { createContext, useCallback, useContext, useState } from "react";
import dynamic from "next/dynamic";
import { parseAsString, useQueryState } from "nuqs";
import type { CattleDetail, CattleListItem } from "../types";

const CattleDetailSheet = dynamic(
  // eslint-disable-next-line import/no-cycle -- the workspace sections call back into this provider (MILESTONE 31)
  () => import("../components/detail/cattle-detail-sheet").then((m) => m.CattleDetailSheet),
  { ssr: false },
);
const CattleDisposeDialog = dynamic(
  () => import("../components/cattle-dispose-dialog").then((m) => m.CattleDisposeDialog),
  { ssr: false },
);
const CattleDeleteDialog = dynamic(
  () => import("../components/cattle-delete-dialog").then((m) => m.CattleDeleteDialog),
  { ssr: false },
);
const RecordSaleDialog = dynamic(
  () => import("@/features/sales/components/record-sale-wizard").then((m) => m.RecordSaleDialog),
  { ssr: false },
);

interface CattleDetailModalContextValue {
  cattleId: string | null;
  isOpen: boolean;
  /** `options.record` opens that event form on arrival (`?record=<key>&ref=<id>`, RFE-160). */
  openCattleDetail: (id: string, options?: { record?: string; ref?: string }) => void;
  closeCattleDetail: () => void;
}

const CattleDetailModalContext = createContext<CattleDetailModalContextValue | null>(null);

export function CattleDetailModalProvider({ children }: { children: React.ReactNode }) {
  const [viewId, setViewId] = useQueryState("view", parseAsString);
  const [, setRecordParam] = useQueryState("record", parseAsString);
  const [, setRefParam] = useQueryState("ref", parseAsString);
  const [disposeTarget, setDisposeTarget] = useState<CattleListItem | CattleDetail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CattleListItem | CattleDetail | null>(null);
  const [saleTarget, setSaleTarget] = useState<CattleListItem | CattleDetail | null>(null);
  // Opened straight into an event form from another page (`record` option): show the form alone, not the profile sheet.
  const [formOnly, setFormOnly] = useState(false);

  const openCattleDetail = useCallback(
    (id: string, options?: { record?: string; ref?: string }) => {
      void setViewId(id);
      setFormOnly(Boolean(options?.record));
      if (options?.record) {
        void setRecordParam(options.record);
        void setRefParam(options.ref ?? null);
      }
    },
    [setViewId, setRecordParam, setRefParam],
  );

  const closeCattleDetail = useCallback(() => {
    setFormOnly(false);
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

      {viewId != null && (
        <CattleDetailSheet
          cattleId={viewId ?? undefined}
          formOnly={formOnly}
          onOpenChange={(open) => !open && closeCattleDetail()}
          onDispose={(cattle) => {
            closeCattleDetail();
            setDisposeTarget(cattle);
          }}
          onDelete={(cattle) => {
            closeCattleDetail();
            setDeleteTarget(cattle);
          }}
        />
      )}

      {disposeTarget != null && (
        <CattleDisposeDialog
          open={disposeTarget !== null}
          onOpenChange={(open) => !open && setDisposeTarget(null)}
          cattle={disposeTarget as CattleListItem | null}
          onRequestSale={(item) => setSaleTarget(item)}
        />
      )}

      {saleTarget != null && (
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
      )}

      {deleteTarget != null && (
        <CattleDeleteDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          cattle={deleteTarget as CattleListItem | null}
        />
      )}
    </CattleDetailModalContext.Provider>
  );
}

/** Like `useCattleDetailModal` but `null` outside the provider (list cells rendered in isolation, tests). */
export function useOptionalCattleDetailModal(): CattleDetailModalContextValue | null {
  return useContext(CattleDetailModalContext);
}

export function useCattleDetailModal(): CattleDetailModalContextValue {
  const context = useContext(CattleDetailModalContext);
  if (!context) {
    throw new Error("useCattleDetailModal must be used within a CattleDetailModalProvider");
  }
  return context;
}
