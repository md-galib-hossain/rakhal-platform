"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { reportsApi } from "../api";

/**
 * `DELETE /reports/:id` (farm owner only). Drops the detail cache and refreshes the history.
 * Errors: `REPORT_OWNER_ONLY` (403), `REPORT_PROCESSING` (409, still being generated).
 */
export function useDeleteReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reportsApi.remove(id),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: qk.reports.detail(id) });
      void queryClient.invalidateQueries({ queryKey: qk.reports.listAll() });
    },
  });
}
