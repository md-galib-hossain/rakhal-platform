"use client";

import { useMutation } from "@tanstack/react-query";
import { authApi } from "../api";
import type { RegisterInput } from "../schemas";

export function useRegister() {
  return useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input),
  });
}
