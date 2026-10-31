"use client"; // react-query mutation hooks

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import type { BulkBody, BulkResponse } from "./bulk-model";

/** RAKHAL-489 — `POST /animal-events/bulk` (`?dryRun=true` writes nothing and returns who is eligible). */
export const bulkEventsApi = {
  submit(body: BulkBody, dryRun: boolean): Promise<BulkResponse> {
    return apiFetch<BulkResponse>("/animal-events/bulk", {
      method: "POST",
      body,
      ...(dryRun ? { searchParams: { dryRun: true } } : {}),
    });
  },
};

/** Sends the chunks one after another; a failed chunk stops the run. */
async function submitAll(bodies: BulkBody[], dryRun: boolean): Promise<BulkResponse[]> {
  const out: BulkResponse[] = [];
  for (const body of bodies) out.push(await bulkEventsApi.submit(body, dryRun));
  return out;
}

export function useBulkDryRun() {
  return useMutation({ mutationFn: (bodies: BulkBody[]) => submitAll(bodies, true) });
}

export function useBulkRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bodies: BulkBody[]) => submitAll(bodies, false),
    onSettled: () => {
      for (const key of ["cattle", "events", "reproduction", "health", "healthcare", "tasks"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}
