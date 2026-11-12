"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { settingsApi } from "../api";

export function useFarmSettings() {
  return useQuery({ queryKey: qk.settings.farm(), queryFn: settingsApi.getFarm });
}

export function useSheds() {
  return useQuery({ queryKey: qk.settings.sheds(), queryFn: settingsApi.listSheds });
}

export function useSuppliers() {
  return useQuery({ queryKey: qk.settings.suppliers(), queryFn: settingsApi.listSuppliers });
}

export function useServiceProviders() {
  return useQuery({ queryKey: qk.settings.serviceProviders(), queryFn: settingsApi.listServiceProviders });
}
