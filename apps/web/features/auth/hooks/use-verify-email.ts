"use client";

import { useMutation } from "@tanstack/react-query";
import { authApi } from "../api";

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (token: string) => authApi.verifyEmail(token),
  });
}
