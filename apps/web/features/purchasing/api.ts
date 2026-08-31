"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  CreatePurchasePayload,
  Expense,
  ExpensesListFilters,
  Purchase,
  PurchaseListRow,
  PayableWithDerived,
  PurchasingListFilters,
  PurchasingSummary,
  RecordExpensePayload,
} from "./types";

/**
 * RAKHAL-391 (MILESTONE 22) — Purchasing API functions, rewritten onto the v2 cursor+filter list
 * routes RAKHAL-375 shipped (`ListPurchasesQueryDto`/`ListExpensesQueryDto`, both
 * `CursorPaginationQueryDto` subclasses) + the new `GET /purchasing/summary?from&to`
 * (`PurchasingSummaryService`). Confirmed against `purchase.controller.ts`/`expense.controller.ts`/
 * `purchasing-summary.controller.ts` directly, not guessed. `listPurchases`/`listExpenses` now use
 * `apiFetchPage` — RAKHAL-359's old plain-array note no longer applies.
 */
export const purchasingApi = {
  createExpense(dto: RecordExpensePayload): Promise<Expense> {
    return apiFetch<Expense>("/purchasing/expenses", { method: "POST", body: dto });
  },
  listExpenses(filters: ExpensesListFilters, cursor: string | undefined, limit = 20): Promise<CursorPage<Expense>> {
    return apiFetchPage<Expense>("/purchasing/expenses", { searchParams: { ...filters, cursor, limit } });
  },
  findExpense(id: string): Promise<Expense> {
    return apiFetch<Expense>(`/purchasing/expenses/${id}`);
  },

  createPurchase(dto: CreatePurchasePayload): Promise<Purchase> {
    return apiFetch<Purchase>("/purchasing/purchases", { method: "POST", body: dto });
  },
  listPurchases(filters: PurchasingListFilters, cursor: string | undefined, limit = 20): Promise<CursorPage<PurchaseListRow>> {
    return apiFetchPage<PurchaseListRow>("/purchasing/purchases", { searchParams: { ...filters, cursor, limit } });
  },
  findPurchase(id: string): Promise<Purchase> {
    return apiFetch<Purchase>(`/purchasing/purchases/${id}`);
  },

  /** `GET /purchasing/summary?from&to` (RAKHAL-375) — the "This Month Summary" panel. */
  getSummary(from: string, to: string): Promise<PurchasingSummary> {
    return apiFetch<PurchasingSummary>("/purchasing/summary", { searchParams: { from, to } });
  },

  /** `GET /purchasing/payables` — cursor-paginated, but `ListPayablesQueryDto` has no
   * `purchaseId`/`expenseId` filter (only `supplierId`/`dueBefore`/`dueAfter` — confirmed reading
   * `list-payables-query.dto.ts`; `status` is deliberately not a filter either, since it's derived
   * not a column). Purchases/Expenses tables cross-reference their own payable by matching
   * `purchaseId`/`expenseId` client-side against one page of results — acceptable for a farm's
   * realistic outstanding-payable volume; a dedicated `?purchaseId=`/`?expenseId=` filter would be a
   * small, worthwhile backend follow-up if this ever needs to page past its first ~100 rows for this
   * purpose specifically (flagged, not silently worked around further). */
  listPayables(limit = 100): Promise<CursorPage<PayableWithDerived>> {
    return apiFetchPage<PayableWithDerived>("/purchasing/payables", { searchParams: { limit } });
  },

  /** `POST /purchasing/purchases/:id/void` (RAKHAL-377) — `finance.reverse`. Refuses if the
   * purchase's payable has any allocation (surfaced via `ApiError.message`). */
  voidPurchase(id: string): Promise<Purchase> {
    return apiFetch<Purchase>(`/purchasing/purchases/${id}/void`, { method: "POST" });
  },
  /** `POST /purchasing/expenses/:id/void` (RAKHAL-377) — same rule as `voidPurchase`. */
  voidExpense(id: string): Promise<Expense> {
    return apiFetch<Expense>(`/purchasing/expenses/${id}/void`, { method: "POST" });
  },
};
