"use client";

import { createContext, useContext } from "react";

export interface CattleDetailModalContextValue {
  cattleId: string | null;
  isOpen: boolean;
  /** `options.record` opens that event form on arrival (`?record=<key>&ref=<id>`, RFE-160). */
  openCattleDetail: (id: string, options?: { record?: string; ref?: string }) => void;
  closeCattleDetail: () => void;
}

export const CattleDetailModalContext = createContext<CattleDetailModalContextValue | null>(null);

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
