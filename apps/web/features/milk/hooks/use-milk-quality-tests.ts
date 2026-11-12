"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { milkApi } from "../api";
import type { CreateMilkQualityTestInput } from "../types";

const STALE_TIME = 60_000;

/** RAKHAL-282/293-F — one cow's quality-test history, cursor-paginated (`GET /milk/quality-tests`).
 * `useInfiniteQuery` matches the `DataTable` "load more" contract other cursor lists here use. */
export function useMilkQualityTests(cattleId: string) {
  return useInfiniteQuery({
    queryKey: qk.milk.qualityTests(cattleId),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      milkApi.qualityTests({ cattleId, cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.meta.hasNextPage ? lastPage.meta.endCursor : undefined),
    staleTime: STALE_TIME,
    enabled: !!cattleId,
  });
}

/** `milk.quality.create`-gated — invalidates this cow's history + the Overview tab's `recent_milk_records`
 * read (backend doesn't join quality tests into it today, but keeping both fresh is cheap and correct). */
export function useCreateMilkQualityTest(cattleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMilkQualityTestInput) => milkApi.createQualityTest(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.milk.qualityTests(cattleId) });
    },
  });
}
