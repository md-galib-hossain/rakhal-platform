"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  AllocatePaymentPayload,
  CreateFinancialAccountPayload,
  CreatePaymentPayload,
  CreateTransferPayload,
  ExpenseSummary,
  FinancePayment,
  FinancePaymentWithAllocations,
  FinancialAccount,
  ListPayablesFilters,
  ListReceivablesFilters,
  Payable,
  Purchase,
  PaymentAllocation,
  PurchaseSummary,
  RakhalBalanceResult,
  Receivable,
  Sale,
  SaleSummary,
  Transfer,
  UpdateFinancialAccountPayload,
} from "./types-v2";

/**
 * RAKHAL-355 — Finance V2 API functions, live against the real backend (`GET`/`POST
 * /finance/accounts`, RAKHAL-335 — done, not a mock). Kept in a separate file from `./api.ts` for
 * the same reason as `./types-v2.ts` — V1's `api.ts` is frozen alongside the rest of
 * `features/finance/**`, and `-v2` mirrors the backend's own module folder name.
 */
export const financeV2Api = {
  /** `GET /finance/accounts` — not paginated (a farm's Cash/Bank/MFS account list is small; the
   * backend route itself returns a plain array via `findAll`, not a cursor page). */
  listAccounts(): Promise<FinancialAccount[]> {
    return apiFetch<FinancialAccount[]>("/finance/accounts");
  },
  createAccount(dto: CreateFinancialAccountPayload): Promise<FinancialAccount> {
    return apiFetch<FinancialAccount>("/finance/accounts", { method: "POST", body: dto });
  },
  /** `PATCH /finance/accounts/:id` — RAKHAL-356. `type` is immutable, not part of the DTO. */
  updateAccount(id: string, dto: UpdateFinancialAccountPayload): Promise<FinancialAccount> {
    return apiFetch<FinancialAccount>(`/finance/accounts/${id}`, { method: "PATCH", body: dto });
  },
  /** `PATCH /finance/accounts/:id/primary` — makes this the farm's one default wallet. No body. */
  setPrimaryAccount(id: string): Promise<FinancialAccount> {
    return apiFetch<FinancialAccount>(`/finance/accounts/${id}/primary`, { method: "PATCH" });
  },
  /** `PATCH /finance/accounts/:id/archive` — RAKHAL-356. No body; soft-delete, not a real delete. */
  archiveAccount(id: string): Promise<FinancialAccount> {
    return apiFetch<FinancialAccount>(`/finance/accounts/${id}/archive`, { method: "PATCH" });
  },
  /** `GET /finance/balance` — RAKHAL-356. Rakhal Balance = Cash+Bank+MFS, plus the still-`wired:
   * false` receivable/payable placeholder block (verified live against the current backend source,
   * see `types-v2.ts`'s doc comment — RAKHAL-340/348 landing did not re-point this endpoint). */
  getBalance(): Promise<RakhalBalanceResult> {
    return apiFetch<RakhalBalanceResult>("/finance/balance");
  },
  /** `GET /finance/transfers` — RAKHAL-356. Plain array, no cursor pagination (mirrors `listAccounts`). */
  listTransfers(): Promise<Transfer[]> {
    return apiFetch<Transfer[]>("/finance/transfers");
  },
  /** `POST /finance/transfers` — RAKHAL-356. Permission `finance.transfer`, owner-only (RAKHAL-353). */
  createTransfer(dto: CreateTransferPayload): Promise<Transfer> {
    return apiFetch<Transfer>("/finance/transfers", { method: "POST", body: dto });
  },

  /** `GET /finance/receivables` — RAKHAL-358, cursor-paginated (`ReceivableController.list`,
   * `finance.read`). `status` is not a query filter — see `ListReceivablesFilters`'s own doc
   * comment. */
  listReceivables(filters: ListReceivablesFilters, cursor?: string, limit = 20): Promise<CursorPage<Receivable>> {
    return apiFetchPage<Receivable>("/finance/receivables", {
      searchParams: { customerId: filters.customerId, dueBefore: filters.dueBefore, dueAfter: filters.dueAfter, cursor, limit },
    });
  },
  /** `GET /finance/receivables/:id`. */
  getReceivable(id: string): Promise<Receivable> {
    return apiFetch<Receivable>(`/finance/receivables/${id}`);
  },

  /** `GET /purchasing/payables` — RAKHAL-358, cursor-paginated (`PayableController.list`,
   * `purchasing.read`). **Confirmed the real route path by reading `payable.controller.ts`
   * directly** — it is `purchasing/payables`, not `finance/payables` (V1's path); mirrors
   * `ReceivableController` exactly otherwise. */
  listPayables(filters: ListPayablesFilters, cursor?: string, limit = 20): Promise<CursorPage<Payable>> {
    return apiFetchPage<Payable>("/purchasing/payables", {
      searchParams: { supplierId: filters.supplierId, dueBefore: filters.dueBefore, dueAfter: filters.dueAfter, cursor, limit },
    });
  },
  /** `GET /purchasing/payables/:id`. */
  getPayable(id: string): Promise<Payable> {
    return apiFetch<Payable>(`/purchasing/payables/${id}`);
  },

  /** `POST /finance/payments` — RAKHAL-358/337 (`PaymentController.record`, `finance.create`).
   * Creates the `FinancePayment` row + posts its journal entry; does NOT allocate against any
   * document by itself — `allocatePayment` below is a required second call (confirmed by reading
   * `CreatePaymentDto`/`PaymentService` directly — there is no inline-allocation field on this DTO,
   * unlike the ticket brief's speculative "or check if recordPayment already accepts an inline
   * allocation" question). */
  createPayment(dto: CreatePaymentPayload): Promise<FinancePayment> {
    return apiFetch<FinancePayment>("/finance/payments", { method: "POST", body: dto });
  },
  /** `GET /finance/payments` — plain array, no cursor pagination and no `include: allocations`
   * (confirmed against `PaymentService.findAll`) — a real gap for a farm with many payments; see
   * `use-finance-v2.ts#usePaymentHistory`'s own doc comment for how the payment-history panel
   * works around it. */
  listPayments(): Promise<FinancePayment[]> {
    return apiFetch<FinancePayment[]>("/finance/payments");
  },
  /** `GET /finance/payments/:id` — the one route that DOES include `allocations`. */
  getPayment(id: string): Promise<FinancePaymentWithAllocations> {
    return apiFetch<FinancePaymentWithAllocations>(`/finance/payments/${id}`);
  },
  /** `POST /finance/payments/:id/allocations` — settles part/all of a payment against one or more
   * `Receivable`/`Payable` rows. Rejected server-side if the allocation would over-allocate either
   * the payment itself or the target document (`PaymentService.allocatePayment`,
   * `ReceivableService`/`PayableService.assertWithinOutstanding`). */
  allocatePayment(paymentId: string, dto: AllocatePaymentPayload): Promise<PaymentAllocation[]> {
    return apiFetch<PaymentAllocation[]>(`/finance/payments/${paymentId}/allocations`, { method: "POST", body: dto });
  },

  /** `GET /sales` — RAKHAL-358, un-paginated (`SaleController.findAll`, `sales.read`). Used only to
   * decorate a Receivable row with its `saleNumber` (see `types-v2.ts#SaleSummary`'s doc comment) —
   * never to build a Record Sale flow (that's RAKHAL-357's lane). */
  listSales(): Promise<SaleSummary[]> {
    return apiFetch<SaleSummary[]>("/sales");
  },
  /** `GET /purchasing/purchases` — un-paginated (`PurchaseController.findAll`, `purchasing.read`).
   * Same reference-only purpose as `listSales`. */
  listPurchases(): Promise<PurchaseSummary[]> {
    return apiFetch<PurchaseSummary[]>("/purchasing/purchases");
  },
  /** `GET /purchasing/expenses` — un-paginated (`ExpenseController.findAll`, `purchasing.read`).
   * Same reference-only purpose as `listSales`. */
  listExpenses(): Promise<ExpenseSummary[]> {
    return apiFetch<ExpenseSummary[]>("/purchasing/expenses");
  },

  /** `GET /sales` — RAKHAL-360, same endpoint as `listSales` above but typed with the full
   * `Sale` shape (incl. `lines[].type`/detail) the redesigned Ledger's Sales segment needs to
   * build a human "what was sold" description (milk/animal/inventory/manure) — `listSales`'s
   * `SaleSummary` type (RAKHAL-358) intentionally omits `lines` for its own narrower
   * reference-lookup purpose. Same runtime payload, kept as its own named call (see
   * `lib/query/keys.ts#salesV2`'s doc comment for why the query key is also separate). */
  listSalesDetailed(): Promise<Sale[]> {
    return apiFetch<Sale[]>("/sales");
  },
  /** `GET /purchasing/purchases` — RAKHAL-360, same reasoning as `listSalesDetailed`. */
  listPurchasesDetailed(): Promise<Purchase[]> {
    return apiFetch<Purchase[]>("/purchasing/purchases");
  },
};
