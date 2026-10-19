"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { useCan } from "@/lib/auth/permissions";
import { suppliersApi } from "./api";

const STALE_TIME = 60_000;

/** Whether the user may add a supplier: `purchasing.create` (the module that owns the tab) OR
 * `settings.update` (what `POST /settings/suppliers` itself requires). */
export function useCanAddSupplier(): boolean {
  const can = useCan();
  return can("purchasing.create") || can("settings.update");
}

export function useSuppliersListV2() {
  return useQuery({
    queryKey: qk.suppliers.listV2(),
    queryFn: suppliersApi.list,
    staleTime: STALE_TIME,
  });
}

export function useSuppliersSummaryV2() {
  return useQuery({
    queryKey: qk.suppliers.summaryV2(),
    queryFn: suppliersApi.summary,
    staleTime: STALE_TIME,
  });
}

/** Both this module's own read model AND the write-side `settings.suppliers()` CRUD list need
 * invalidating after a create/edit/delete — the write mutations live in `features/settings/hooks/
 * use-workspace-mutations.ts` (reused as-is, this ticket's lane keeps that file read-only) and only
 * invalidate their own `qk.settings.suppliers()` key, with no knowledge this module's read model
 * even exists. This helper is called from each dialog's own `onSuccess` to invalidate both. */
export function useInvalidateSuppliersV2() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: qk.suppliers.listV2() });
    void queryClient.invalidateQueries({ queryKey: qk.suppliers.summaryV2() });
  };
}
