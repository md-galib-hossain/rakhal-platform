export type ListPhase = "error" | "loading" | "empty" | "list";

/** What the list area shows. A failed first page is an error with retry (never a skeleton); a failed
 * later page keeps the loaded rows (the footer owns that retry). */
export function listPhase(s: { isError: boolean; isLoading: boolean; itemCount: number; isNextPageError?: boolean }): ListPhase {
  if (s.isError || (s.isNextPageError && s.itemCount === 0)) return "error";
  if (s.isLoading) return "loading";
  return s.itemCount === 0 ? "empty" : "list";
}
