/** `SupportCategory` (`@prisma/client`, `prisma/schemas/support/*.prisma`) — no `/support/*` list
 * route exposes an enum-values endpoint, so mirrored here as a literal union (RFE-048). */
export const SUPPORT_CATEGORIES = ["BUG", "FEATURE_REQUEST", "QUESTION", "BILLING", "OTHER"] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

/** `POST /feedback` body (multipart) — `category` + `message` form fields, optional `file` screenshot. */
export interface CreateFeedbackInput {
  category: SupportCategory;
  message: string;
  file?: File | null;
}
