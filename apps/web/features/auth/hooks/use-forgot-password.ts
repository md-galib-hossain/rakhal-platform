"use client";

import { useMutation } from "@tanstack/react-query";
import { authApi } from "../api";
import type { ForgotPasswordInput } from "../schemas";

export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: ForgotPasswordInput) => authApi.forgotPassword(input),
  });
}
