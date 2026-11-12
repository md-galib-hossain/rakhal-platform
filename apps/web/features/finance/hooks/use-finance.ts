"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { financeApi } from "../api";
import type { CreateFixedAssetPayload } from "../types";

const STALE_TIME = 60_000;

export function useLiabilities() {
  return useQuery({
    queryKey: qk.finance.liabilities(),
    queryFn: () => financeApi.liabilities(),
    staleTime: STALE_TIME,
  });
}

export function useAssets() {
  return useQuery({
    queryKey: qk.finance.assets(),
    queryFn: () => financeApi.assets(),
    staleTime: STALE_TIME,
  });
}

export function useCreateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateFixedAssetPayload) => financeApi.createAsset(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.finance.assets() });
    },
  });
}
