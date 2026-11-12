"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { settingsApi } from "../api";
import type { InviteTeamMemberInput } from "../schemas";

export function useInviteTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteTeamMemberInput) => settingsApi.inviteTeamMember(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.settings.team() }),
  });
}

export function useResendInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => settingsApi.resendInvite(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.settings.team() }),
  });
}

export function useRevokeInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => settingsApi.revokeInvite(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.settings.team() }),
  });
}

export function useChangeMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      settingsApi.changeMemberRole(memberId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.settings.team() }),
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => settingsApi.removeMember(memberId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.settings.team() }),
  });
}
