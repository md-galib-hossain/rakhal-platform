"use client";

import { useMemo } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { useCursorPager } from "@/lib/hooks/use-cursor-pager";
import { financeV2Api } from "../api-v2";
import type {
  AllocatePaymentPayload,
  CreateFinancialAccountPayload,
  CreatePaymentPayload,
  CreateTransferPayload,
  ListPayablesFilters,
  ListReceivablesFilters,
  PaymentDirection,
  UpdateFinancialAccountPayload,
} from "../types-v2";

const STALE_TIME = 60_000;

/** `GET /finance/accounts` — backs `AccountPicker`'s search list. */
export function useFinancialAccounts() {
  return useQuery({
    queryKey: qk.finance.accountsV2(),
    queryFn: () => financeV2Api.listAccounts(),
    staleTime: STALE_TIME,
  });
}

/** `AccountPicker`'s inline "+ Add account" quick-add — same "create then invalidate the list"
 * shape as `useCreateCustomUnit` (`features/inventory/hooks/use-inventory.ts`). */
export function useCreateFinancialAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateFinancialAccountPayload) => financeV2Api.createAccount(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.finance.accountsV2() });
      void queryClient.invalidateQueries({ queryKey: qk.finance.balanceV2() });
    },
  });
}

/** RAKHAL-356 — edit an account's name/bank-or-MFS detail. `type` is not editable (see
 * `types-v2.ts#UpdateFinancialAccountPayload`'s doc comment). */
export function useUpdateFinancialAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateFinancialAccountPayload }) => financeV2Api.updateAccount(id, dto),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.finance.accountsV2() }),
  });
}

/** RAKHAL-356 — archive (soft-delete) an account. Also invalidates the balance projection since an
 * archived account drops out of `GET /finance/balance`'s per-account list. */
export function useArchiveFinancialAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeV2Api.archiveAccount(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.finance.accountsV2() });
      void queryClient.invalidateQueries({ queryKey: qk.finance.balanceV2() });
    },
  });
}

/** RAKHAL-356 — `GET /finance/balance`. Rakhal Balance headline + Cash/Bank/MFS breakdown + the
 * receivable/payable placeholder block. */
export function useRakhalBalance() {
  return useQuery({
    queryKey: qk.finance.balanceV2(),
    queryFn: () => financeV2Api.getBalance(),
    staleTime: STALE_TIME,
  });
}

/** RAKHAL-356 — `GET /finance/transfers`, most recent first (backend orders by `transactionDate
 * desc, id desc`). */
export function useTransfers() {
  return useQuery({
    queryKey: qk.finance.transfersV2(),
    queryFn: () => financeV2Api.listTransfers(),
    staleTime: STALE_TIME,
  });
}

/** RAKHAL-356 — `POST /finance/transfers`. Invalidates accounts/balance/transfers together: a
 * transfer changes two accounts' derived balances and the Rakhal Balance total at once. */
export function useCreateTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTransferPayload) => financeV2Api.createTransfer(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.finance.balanceV2() });
      void queryClient.invalidateQueries({ queryKey: qk.finance.transfersV2() });
      void queryClient.invalidateQueries({ queryKey: qk.finance.accountsV2() });
    },
  });
}

// ---------------------------------------------------------------------------------------------
// RAKHAL-358 — Payments, receivables, payables, allocation.
// ---------------------------------------------------------------------------------------------

/** `GET /finance/receivables`, cursor-paginated via the shared `useCursorPager` (same adapter
 * `useLedgerPagedList`/V1's `useReceivablesPagedList` use). */
export function useReceivablesV2PagedList(filters: ListReceivablesFilters) {
  return useCursorPager(
    qk.finance.receivablesV2(filters as Record<string, string | undefined>),
    (cursor, limit) => financeV2Api.listReceivables(filters, cursor, limit),
    { staleTime: STALE_TIME },
  );
}

/** `GET /purchasing/payables`, same pager shape as `useReceivablesV2PagedList`. */
export function usePayablesV2PagedList(filters: ListPayablesFilters) {
  return useCursorPager(
    qk.finance.payablesV2(filters as Record<string, string | undefined>),
    (cursor, limit) => financeV2Api.listPayables(filters, cursor, limit),
    { staleTime: STALE_TIME },
  );
}

/** `GET /sales`, un-paginated — reference-only lookup for decorating a Receivable row with its
 * `saleNumber` (`ReceivablesTable`'s "Sale Reference" column). Small farm-scoped list, same
 * un-paginated convention as `useFinancialAccounts`. */
export function useSalesLookup() {
  return useQuery({
    queryKey: qk.finance.salesLookupV2(),
    queryFn: () => financeV2Api.listSales(),
    staleTime: STALE_TIME,
  });
}

/** `GET /purchasing/purchases` — reference-only lookup for a Payable row's "Purchase Reference"
 * column (only when `purchaseId` is set — an expense-sourced payable uses `useExpensesLookup`
 * instead). */
export function usePurchasesLookup() {
  return useQuery({
    queryKey: qk.finance.purchasesLookupV2(),
    queryFn: () => financeV2Api.listPurchases(),
    staleTime: STALE_TIME,
  });
}

/** `GET /purchasing/expenses` — reference-only lookup for a Payable row raised from an `Expense`
 * (`expenseId` set instead of `purchaseId`). */
export function useExpensesLookup() {
  return useQuery({
    queryKey: qk.finance.expensesLookupV2(),
    queryFn: () => financeV2Api.listExpenses(),
    staleTime: STALE_TIME,
  });
}

/** Invalidates every list a payment/allocation can affect: the receivable/payable rows themselves
 * (outstanding + status both change), the payments list, and Rakhal Balance (an account's derived
 * balance moved). Broad on purpose, same "invalidate everything a write could touch" convention as
 * V1's `useInvalidateFinance`. */
function useInvalidatePaymentsV2() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["finance", "v2", "receivables"] });
    void queryClient.invalidateQueries({ queryKey: ["finance", "v2", "payables"] });
    void queryClient.invalidateQueries({ queryKey: ["finance", "v2", "payments"] });
    void queryClient.invalidateQueries({ queryKey: qk.finance.balanceV2() });
  };
}

/**
 * `POST /finance/payments` — standalone, unallocated. Exposed for completeness/testing; the
 * Receive/Make Payment dialogs use `useSettlePayment` below instead, which chains this with the
 * required `allocatePayment` call in one mutation.
 */
export function useCreatePaymentV2() {
  const invalidate = useInvalidatePaymentsV2();
  return useMutation({
    mutationFn: (dto: CreatePaymentPayload) => financeV2Api.createPayment(dto),
    onSuccess: () => invalidate(),
  });
}

/** `POST /finance/payments/:id/allocations` — standalone. Same completeness note as
 * `useCreatePaymentV2`. */
export function useAllocatePaymentV2() {
  const invalidate = useInvalidatePaymentsV2();
  return useMutation({
    mutationFn: ({ paymentId, dto }: { paymentId: string; dto: AllocatePaymentPayload }) =>
      financeV2Api.allocatePayment(paymentId, dto),
    onSuccess: () => invalidate(),
  });
}

/**
 * `ReceivePaymentDialog`/`MakePaymentDialog`'s single mutation — records a `FinancePayment`
 * (`direction` fixed by `kind`: `RECEIVABLE` → `INCOMING`, `PAYABLE` → `OUTGOING`) and immediately
 * allocates its full amount against `documentId`, as two sequential calls (confirmed against
 * `CreatePaymentDto`/`PaymentService` directly — there is no single-call inline-allocation route;
 * see `api-v2.ts#createPayment`'s own doc comment). Not wrapped in a client-side "rollback the
 * payment if allocation fails" step — the payment row already exists and is a real, valid,
 * unallocated `FinancePayment` even if the second call fails (e.g. a race that over-allocated the
 * document between this dialog opening and submitting); the farmer sees the resulting server error
 * and can retry the allocation, not lose the payment record. A stronger atomicity guarantee (one
 * backend endpoint doing both in one transaction) is a backend follow-up, not something this
 * ticket's frontend-only scope can add.
 */
export function useSettlePayment(kind: "RECEIVABLE" | "PAYABLE") {
  const invalidate = useInvalidatePaymentsV2();
  return useMutation({
    mutationFn: async ({
      documentId,
      dto,
    }: {
      documentId: string;
      dto: Omit<CreatePaymentPayload, "direction">;
    }) => {
      const direction: PaymentDirection = kind === "RECEIVABLE" ? "INCOMING" : "OUTGOING";
      const payment = await financeV2Api.createPayment({ ...dto, direction });
      const allocations = await financeV2Api.allocatePayment(payment.id, {
        allocations: [
          kind === "RECEIVABLE"
            ? { receivableId: documentId, amount: dto.amount }
            : { payableId: documentId, amount: dto.amount },
        ],
      });
      return { payment, allocations };
    },
    onSuccess: () => invalidate(),
  });
}

/**
 * Payment history for one Receivable/Payable — every `FinancePayment` that has an allocation
 * against `documentId`, oldest first, each paired with the running outstanding balance right after
 * that payment. **Documented backend gap**: neither `GET /finance/payments` supports a
 * `receivableId`/`payableId` filter nor does its response include `allocations` (only
 * `GET /finance/payments/:id` does) — there is no single route that answers "every payment for this
 * document." This hook works around it with a fan-out: one `GET /finance/payments` call (small,
 * un-paginated, whole-farm) followed by one `GET /finance/payments/:id` per payment (`useQueries`,
 * cached per id) to read each one's `allocations`, then filters+sorts client-side. Fine for a
 * demo/early-stage farm's payment volume; a farm with hundreds of payments would want a real
 * `receivableId`/`payableId` filter on the backend list route instead — flagged in this ticket's
 * `docs/PROJECT_PROGRESS.md` gap table, not silently worked around forever. Disabled entirely while
 * `documentId` is `undefined` (e.g. a closed dialog) so it never fires for no reason.
 */
export function usePaymentHistory(kind: "RECEIVABLE" | "PAYABLE", documentId: string | undefined) {
  const paymentsQuery = useQuery({
    queryKey: qk.finance.paymentsV2(),
    queryFn: () => financeV2Api.listPayments(),
    enabled: documentId != null,
    staleTime: STALE_TIME,
  });

  const paymentIds = paymentsQuery.data?.map((p) => p.id) ?? [];
  const detailQueries = useQueries({
    queries: paymentIds.map((id) => ({
      queryKey: qk.finance.paymentDetailV2(id),
      queryFn: () => financeV2Api.getPayment(id),
      enabled: documentId != null,
      staleTime: STALE_TIME,
    })),
  });

  const isLoading = paymentsQuery.isLoading || (paymentIds.length > 0 && detailQueries.some((q) => q.isLoading));
  const isError = paymentsQuery.isError || detailQueries.some((q) => q.isError);

  const rows = useMemo(() => {
    if (!documentId) return [];
    const matches: { paymentId: string; financialAccountId: string; method: string; transactionDate: string; referenceNumber: string | null; amount: number }[] = [];
    for (const q of detailQueries) {
      const payment = q.data;
      if (!payment) continue;
      for (const allocation of payment.allocations) {
        const matchesDocument = kind === "RECEIVABLE" ? allocation.receivableId === documentId : allocation.payableId === documentId;
        if (!matchesDocument) continue;
        matches.push({
          paymentId: payment.id,
          financialAccountId: payment.financialAccountId,
          method: payment.method,
          transactionDate: payment.transactionDate,
          referenceNumber: payment.referenceNumber,
          amount: Number(allocation.amount),
        });
      }
    }
    return matches.sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));
  }, [detailQueries, documentId, kind]);

  return { rows, isLoading, isError };
}

// ---------------------------------------------------------------------------------------------
// RAKHAL-360 — Finance dashboard + redesigned Ledger view's "business document list" segments.
// ---------------------------------------------------------------------------------------------

/** `GET /finance/payments`, un-paginated — backs the Ledger's Payments segment. Same key/queryFn
 * `usePaymentHistory` above already uses for its own fan-out, so the two share one cache entry. */
export function usePaymentsV2() {
  return useQuery({
    queryKey: qk.finance.paymentsV2(),
    queryFn: () => financeV2Api.listPayments(),
    staleTime: STALE_TIME,
  });
}

/** `GET /sales`, un-paginated, list-projection `Sale` shape (`lineSummary`, not `lines[]`) — backs the Ledger's Sales
 * segment. Separate cache key from RAKHAL-358's `useSalesLookup` (see `lib/query/keys.ts#salesV2`'s
 * doc comment for why). */
export function useSalesV2() {
  return useQuery({
    queryKey: qk.finance.salesV2(),
    queryFn: () => financeV2Api.listSalesDetailed(),
    staleTime: STALE_TIME,
  });
}

/** `GET /purchasing/purchases`, un-paginated, full `Purchase` shape (incl. `lines[]`) — backs the
 * Ledger's Purchases segment. Separate cache key from RAKHAL-358's `usePurchasesLookup`. */
export function usePurchasesV2() {
  return useQuery({
    queryKey: qk.finance.purchasesV2(),
    queryFn: () => financeV2Api.listPurchasesDetailed(),
    staleTime: STALE_TIME,
  });
}
