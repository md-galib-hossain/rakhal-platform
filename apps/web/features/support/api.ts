"use client";

import { apiUpload } from "@/lib/api/client";
import type { CreateFeedbackInput } from "./types";

/** `/feedback` — real backend route (`feedback.controller.ts`), any authenticated farm member,
 * no extra permission gate. Multipart: `category` + `message` fields, optional `file` screenshot. */
export const supportApi = {
  submitFeedback(input: CreateFeedbackInput): Promise<null> {
    return apiUpload<null>("/feedback", input.file ?? undefined, "file", {
      category: input.category,
      message: input.message,
    });
  },
};
