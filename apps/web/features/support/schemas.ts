import { z } from "zod";
import { SUPPORT_CATEGORIES } from "./types";

export const feedbackFormSchema = z.object({
  category: z.enum(SUPPORT_CATEGORIES),
  message: z.string().trim().min(3).max(2000),
});

export type FeedbackFormInput = z.infer<typeof feedbackFormSchema>;
