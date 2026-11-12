"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { settingsApi } from "../api";
import type {
  ServiceProviderFormInput,
  ShedFormInput,
  SupplierFormInput,
  UpdateFarmInput,
} from "../schemas";

export function useUpdateFarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateFarmInput) => settingsApi.updateFarm(input),
    // The farm's timezone decides "today" server-side (feeding/milk calendars, dashboards, reports), so a change can
    // shift what every date-driven screen shows — refetch everything rather than guess which queries depend on it.
    onSuccess: () => queryClient.invalidateQueries(),
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

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SupplierFormInput) => settingsApi.createSupplier(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.settings.suppliers() }),
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SupplierFormInput }) => settingsApi.updateSupplier(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.settings.suppliers() }),
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => settingsApi.deleteSupplier(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.settings.suppliers() }),
  });
}

export function useCreateServiceProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ServiceProviderFormInput) => settingsApi.createServiceProvider(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.settings.serviceProviders() }),
  });
}

export function useUpdateServiceProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ServiceProviderFormInput }) =>
      settingsApi.updateServiceProvider(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.settings.serviceProviders() }),
  });
}

export function useDeleteServiceProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => settingsApi.deleteServiceProvider(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.settings.serviceProviders() }),
  });
}
