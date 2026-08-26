"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  AllocatePaymentPayload,
  CreateIncomeCategoryPayload,
  CreatePaymentPayload,
  IncomeCategory,
  MilkAvailabilityResult,
  OtherIncomeResult,
  PaymentResult,
  ReceivableSummary,
  RecordOtherIncomePayload,
  SellAnimalPayload,
  SellAnimalResult,
} from "./types";

/**
 * RAKHAL-357 — Record Sale flow API functions, live against the real Finance V2 routes this
 * ticket actually wires up (see `types.ts`'s top doc comment for which sale types are real vs
 * blocked). Milk itself reuses `features/buyers/api.ts#buyersApi.recordDispatch` +
 * `useBuyersPagedList`/`useRecordDispatch` rather than re-declaring `POST /milk/dispatch` here —
 * house convention is to search before creating, and that hook is already the live, tested path.
 */
export const salesApi = {
  /** `GET /milk/availability` (RAKHAL-343). */
  milkAvailability(tankId?: string): Promise<MilkAvailabilityResult> {
    return apiFetch<MilkAvailabilityResult>("/milk/availability", { searchParams: { tankId } });
  },

  /** `POST /sales/animal/:cattleId` (RAKHAL-345/399) — the real atomic animal-sale flow:
   * `Sale`+`CattleDisposition`+ledger posting+optional `Payment`, all in one server transaction. */
  sellAnimal(cattleId: string, dto: SellAnimalPayload): Promise<SellAnimalResult> {
    return apiFetch<SellAnimalResult>(`/sales/animal/${cattleId}`, { method: "POST", body: dto });
  },

  /** `GET /finance/income/categories` (RAKHAL-350). */
  listIncomeCategories(): Promise<IncomeCategory[]> {
    return apiFetch<IncomeCategory[]>("/finance/income/categories");
  },

  /** `POST /finance/income/categories` — farm-custom category quick-add. */
  createIncomeCategory(dto: CreateIncomeCategoryPayload): Promise<IncomeCategory> {
    return apiFetch<IncomeCategory>("/finance/income/categories", { method: "POST", body: dto });
  },

  /** `POST /finance/income` — records + posts in one call, no separate payment step. */
  recordOtherIncome(dto: RecordOtherIncomePayload): Promise<OtherIncomeResult> {
    return apiFetch<OtherIncomeResult>("/finance/income", { method: "POST", body: dto });
  },

  /** `POST /finance/payments` (RAKHAL-337) — records the money movement itself. */
  createPayment(dto: CreatePaymentPayload): Promise<PaymentResult> {
    return apiFetch<PaymentResult>("/finance/payments", { method: "POST", body: dto });
  },

  /** `POST /finance/payments/:id/allocations` — settles the payment against a receivable. */
  allocatePayment(paymentId: string, dto: AllocatePaymentPayload): Promise<unknown> {
    return apiFetch(`/finance/payments/${paymentId}/allocations`, { method: "POST", body: dto });
  },

  /**
   * `GET /finance/receivables` (RAKHAL-340), unfiltered, newest-first (the route's own default
   * `sortOrder`) — used only to find the `Receivable` a just-created milk sale raised. **Real gap
   * found live-verifying this ticket, not assumed from reading source**: `?customerId=` looked
   * like the right filter (`SellMilkUseCase` passes the buyer as `Sale.customerId`, and
   * `ListReceivablesQueryDto` accepts `customerId`) — but `ReceivableService.createReceivable`
   * never actually persists a `customerId` on the `Receivable` row itself (confirmed by reading
   * its `client.receivable.create({ data: {...} })` call — no `customerId` field — and by hitting
   * the live dev backend: `GET /finance/receivables?customerId=<realBuyerId>` returned an empty
   * page for a sale that had just been created for that exact buyer). Every `Receivable.customerId`
   * is `null` today, for every sale type, not just milk — filtering by it can never match.
   * Falls back to what's actually reliable: the just-created receivable is always the newest row
   * for this farm (proven live — a fresh dispatch's `saleId` matched `items[0]` of an unfiltered
   * `limit=5` call), so this fetches the most recent few and matches `saleId` client-side. Flagged
   * in this ticket's IN_FLIGHT writeup as a real backend gap (`Receivable.customerId` dead code)
   * worth a follow-up ticket, not silently worked around.
   */
  listRecentReceivables(): Promise<CursorPage<ReceivableSummary>> {
    return apiFetchPage<ReceivableSummary>("/finance/receivables", { searchParams: { limit: 5 } });
  },
};
