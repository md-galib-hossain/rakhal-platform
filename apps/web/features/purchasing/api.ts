"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  CreatePurchasePayload,
  Expense,
  Purchase,
  PurchaseListRow,
  PayableWithDerived,
  RecordExpensePayload,
} from "./types";

/**
 * RAKHAL-359 — Purchasing API functions, live against the real backend (`purchasing/purchases`,
 * `purchasing/expenses`, `purchasing/payables` — RAKHAL-348/349, done, not mocked).
 *
 * Note on list routes: `PurchaseController.findAll`/`ExpenseController.findAll` return a **plain
 * array**, not a cursor page (`purchase.service.ts#findAll`/`expense.service.ts#findAll` both call
 * `findMany` directly, no `toCursorPage`) — unlike almost every other list route in this codebase.
 * Confirmed by reading the controller/service source directly rather than assumed from the house
 * cursor-pagination convention; `apiFetch` (not `apiFetchPage`) is used here for that reason.
 */
export const purchasingApi = {
  createExpense(dto: RecordExpensePayload): Promise<Expense> {
    return apiFetch<Expense>("/purchasing/expenses", { method: "POST", body: dto });
  },
  listExpenses(): Promise<Expense[]> {
    return apiFetch<Expense[]>("/purchasing/expenses");
  },
  findExpense(id: string): Promise<Expense> {
    return apiFetch<Expense>(`/purchasing/expenses/${id}`);
  },

  createPurchase(dto: CreatePurchasePayload): Promise<Purchase> {
    return apiFetch<Purchase>("/purchasing/purchases", { method: "POST", body: dto });
  },
  listPurchases(): Promise<PurchaseListRow[]> {
    return apiFetch<PurchaseListRow[]>("/purchasing/purchases");
  },
  findPurchase(id: string): Promise<Purchase> {
    return apiFetch<Purchase>(`/purchasing/purchases/${id}`);
  },

  /** `GET /purchasing/payables` — cursor-paginated, but `ListPayablesQueryDto` has no
   * `purchaseId`/`expenseId` filter (only `supplierId`/`dueBefore`/`dueAfter` — confirmed reading
   * `list-payables-query.dto.ts`; `status` is deliberately not a filter either, same reasoning as
   * `ReceivableService`, since it's derived not a column). This view cross-references a purchase's/
   * expense's own payable by matching `purchaseId`/`expenseId` client-side against one page of
   * results — acceptable for a farm's realistic outstanding-payable volume; a dedicated
   * `?purchaseId=`/`?expenseId=` filter would be a small, worthwhile backend follow-up if this list
   * ever needs to page past its first ~50 rows for this purpose specifically. */
  listPayables(limit = 100): Promise<CursorPage<PayableWithDerived>> {
    return apiFetchPage<PayableWithDerived>("/purchasing/payables", { searchParams: { limit } });
  },
};
