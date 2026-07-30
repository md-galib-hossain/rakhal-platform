"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { settingsApi } from "../api";
import type { FeedGroupFormInput, ShedFormInput, UpdateFarmInput } from "../schemas";

export function useUpdateFarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateFarmInput) => settingsApi.updateFarm(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.settings.farm() }),
  });
}

export function useCreateShed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ShedFormInput) => settingsApi.createShed(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.settings.sheds() }),
  });
}

export function useUpdateShed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ShedFormInput }) => settingsApi.updateShed(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.settings.sheds() }),
  });
}

export function useDeleteShed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => settingsApi.deleteShed(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.settings.sheds() }),
  });
}

export function useCreateFeedGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FeedGroupFormInput) => settingsApi.createFeedGroup(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.settings.feedGroups() }),
  });
}

export function useUpdateFeedGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: FeedGroupFormInput }) =>
      settingsApi.updateFeedGroup(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.settings.feedGroups() }),
  });
}

export function useDeleteFeedGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => settingsApi.deleteFeedGroup(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.settings.feedGroups() }),
  });
}
