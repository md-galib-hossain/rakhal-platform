"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { settingsApi } from "../api";

export function useTeam() {
  return useQuery({ queryKey: qk.settings.team(), queryFn: settingsApi.listTeam });
}

export function useRoles() {
  return useQuery({ queryKey: qk.settings.roles(), queryFn: settingsApi.listRoles });
}
