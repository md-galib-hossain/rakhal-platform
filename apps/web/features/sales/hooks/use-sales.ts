"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { toPeriodKey, type PeriodRange } from "@/lib/period/presets";
import { salesApi } from "../api";
import type {
  AllocatePaymentPayload,
  CreateIncomeCategoryPayload,
  CreatePaymentPayload,
  DispatchListFilters,
  InvoiceListFilters,
  RecordOtherIncomePayload,
  RecordReceiptPayload,
  SalesTrendGranularity,
  SellAnimalPayload,
  SellInventoryPayload,
  SellManurePayload,
} from "../types";

const STALE_TIME = 30_000;

/** RAKHAL-343 — `GET /milk/availability`, backs the wizard's live available-quantity display on
 * the Milk sub-type step. Short stale time — this is a "how much can I sell right now" number,
 * not a slow-changing catalogue. */
export function useMilkAvailability(enabled: boolean) {
  return useQuery({
    queryKey: qk.finance.milkAvailabilityV2(undefined),
    queryFn: () => salesApi.milkAvailability(),
    enabled,
    staleTime: STALE_TIME,
  });
}

/** The sale's open `Receivable` (null when it was paid in full at the sale). Disabled until a sale id is
 * given, so a closed sheet never pages the receivables list. */
export function useReceivableForSale(saleId: string | undefined) {
  return useQuery({
    queryKey: ["sales", "v2", "receivable-for-sale", saleId],
    queryFn: () => salesApi.findReceivableBySale(saleId!),
    enabled: saleId != null,
    staleTime: STALE_TIME,
  });
}

export function useIncomeCategories(enabled: boolean) {
  return useQuery({
    queryKey: qk.finance.incomeCategoriesV2(),
    queryFn: () => salesApi.listIncomeCategories(),
    enabled,
    staleTime: 60_000,
  });
}

export function useCreateIncomeCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateIncomeCategoryPayload) => salesApi.createIncomeCategory(dto),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.finance.incomeCategoriesV2() }),
  });
}

/** Other Income posts + settles in one call — broad invalidation mirrors `useRecordDispatch`'s own
 * precedent (`features/buyers/hooks/use-buyers.ts`). */
export function useRecordOtherIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: RecordOtherIncomePayload) => salesApi.recordOtherIncome(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
  });
}

/** `POST /sales/animal/:cattleId` (RAKHAL-345/399) — the real atomic sell-animal flow. Broad
 * `["cattle"]` invalidation since the sold animal's `herdStatus` flips to SOLD and drops out of
 * the active-herd list/detail views, plus `["finance"]` for the ledger posting this always makes. */
export function useSellAnimal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cattleId, dto }: { cattleId: string; dto: SellAnimalPayload }) =>
      salesApi.sellAnimal(cattleId, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cattle"] });
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
  });
}

/** `POST /sales/inventory` (RAKHAL-346/376) — real atomic inventory-sale flow. Invalidates
 * `["inventory"]` too (the sold item's stock decrements), same convention `useCreatePurchase`
 * (Purchasing) established for its own inventory-stock side effect. */
export function useSellInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: SellInventoryPayload) => salesApi.sellInventory(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
  });
}

/** `POST /sales/manure` (RAKHAL-347/376) — no inventory side effect (RD-058: no manure stock model). */
export function useSellManure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: SellManurePayload) => salesApi.sellManure(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
  });
}

/** `GET /sales` v2 (RAKHAL-368), unpaginated small page — backs the Overview screen's "Recent
 * Sales" table (5 newest, default `sortOrder` is newest-first per house cursor convention). */
export function useRecentInvoices(limit = 5) {
  return useQuery({
    queryKey: qk.sales.invoicesListV2({ limit: String(limit) }),
    queryFn: () => salesApi.listInvoices({}, undefined, limit),
    staleTime: STALE_TIME,
  });
}

/** `GET /sales` v2 (RAKHAL-368) — cursor "load more", backs the Invoices tab. */
export function useInvoicesList(filters: InvoiceListFilters) {
  return useInfiniteQuery({
    queryKey: qk.sales.invoicesListV2(filters as Record<string, string | undefined>),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => salesApi.listInvoices(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.meta.hasNextPage ? lastPage.meta.endCursor : undefined),
    staleTime: STALE_TIME,
  });
}

/** `GET /sales/summary?from&to&granularity` (RAKHAL-374) — backs the Overview screen; period+
 * granularity-keyed so switching either refetches. */
export function useSalesSummary(range: PeriodRange, granularity: SalesTrendGranularity) {
  const periodKey = `${toPeriodKey(range)}:${granularity}`;
  return useQuery({
    queryKey: qk.sales.summaryV2(periodKey),
    queryFn: () => salesApi.getSummary(range.from.toISOString(), range.to.toISOString(), granularity),
    staleTime: STALE_TIME,
  });
}

/** `GET /buyers/dispatches` v2 (RAKHAL-378) — cursor "load more", backs the Dispatches tab. */
export function useDispatchesList(filters: DispatchListFilters) {
  return useInfiniteQuery({
    queryKey: qk.sales.dispatchesListV2(filters as Record<string, string | undefined>),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => salesApi.listDispatches(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.meta.hasNextPage ? lastPage.meta.endCursor : undefined),
    staleTime: STALE_TIME,
  });
}

export function useDispatchesSummary() {
  return useQuery({
    queryKey: qk.sales.dispatchesSummaryV2(),
    queryFn: () => salesApi.getDispatchesSummary(),
    staleTime: STALE_TIME,
  });
}

function invalidateDispatchLists(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["sales", "v2", "dispatches"] });
  void queryClient.invalidateQueries({ queryKey: ["finance"] });
}

export function useRecordReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: RecordReceiptPayload }) => salesApi.recordReceipt(id, dto),
    onSuccess: () => invalidateDispatchLists(queryClient),
  });
}

export function useCancelDispatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => salesApi.cancelDispatch(id),
    onSuccess: () => invalidateDispatchLists(queryClient),
  });
}

function invalidateSalesLists(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["sales"] });
  void queryClient.invalidateQueries({ queryKey: ["finance"] });
}

/** `POST /sales/:id/cancel` (RAKHAL-377/392). */
export function useCancelSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => salesApi.cancelSale(id),
    onSuccess: () => invalidateSalesLists(queryClient),
  });
}

/** `POST /sales/:id/refund` (RAKHAL-377/392). */
export function useRefundSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => salesApi.refundSale(id),
    onSuccess: () => invalidateSalesLists(queryClient),
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePaymentPayload) => salesApi.createPayment(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
  });
}

export function useAllocatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, dto }: { paymentId: string; dto: AllocatePaymentPayload }) =>
      salesApi.allocatePayment(paymentId, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
  });
}

/**
 * Finds the `Receivable` a just-recorded milk sale raised, so the wizard can allocate the
 * farmer's "Amount Received" against it. `Receivable.saleId` is `@unique` server-side, but no
 * `?saleId=` filter exists on `GET /finance/receivables` — and live-verifying this ticket against
 * the real backend found `?customerId=` (the filter that looked right) never actually matches
 * anything, because `Receivable.customerId` is never persisted (`api.ts#listRecentReceivables`'s
 * doc comment has the full story). So this fetches the newest few receivables, unfiltered
 * (default sort is newest-first — proven live: a fresh dispatch's `saleId` matched `items[0]`),
 * and matches `saleId` client-side. Called imperatively inside the submit flow (not a cached
 * `useQuery`) — there's nothing to cache, this is a one-shot lookup the moment after a sale is
 * created.
 */
export async function findReceivableBySale(saleId: string) {
  const page = await salesApi.listRecentReceivables();
  return page.items.find((r) => r.saleId === saleId) ?? page.items[0];
}
