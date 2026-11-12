"use client";

import { useMutation } from "@tanstack/react-query";
import { authApi } from "../api";
import type { ResetPasswordInput } from "../schemas";

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: ResetPasswordInput) => authApi.resetPassword(input),
  });
}
