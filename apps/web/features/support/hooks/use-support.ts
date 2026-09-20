"use client";

import { useMutation } from "@tanstack/react-query";
import { supportApi } from "../api";
import type { CreateFeedbackInput } from "../types";

/** No query to invalidate on success — feedback has no list view in this app (admin-only, out of
 * the customer-api surface), so this is a pure fire-and-forget mutation. */
export function useSubmitFeedback() {
  return useMutation({
    mutationFn: (input: CreateFeedbackInput) => supportApi.submitFeedback(input),
  });
}
