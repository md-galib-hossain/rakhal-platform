import { z } from "zod";

/**
 * RAKHAL-356 — zod schemas for the Finance V2 Accounts + Rakhal Balance screen. Kept in a separate
 * `-v2` file from `./schemas.ts` for the same reason `types-v2.ts`/`api-v2.ts` are split from V1's
 * — `features/finance/**` (V1) is frozen for new features, and this ticket's forms post against the
 * new WALLET-less V2 backend surface (`finance-v2/**`), not the V1 `finance.controller.ts` route.
 */

export const MFS_PROVIDERS = ["BKASH", "NAGAD", "ROCKET", "UPAY", "OTHER"] as const;

/** Edit-account form — `type` is deliberately absent (immutable server-side, see
 * `types-v2.ts#UpdateFinancialAccountPayload`'s doc comment). The conditional bank/MFS detail
 * requirement is enforced by the caller reading the account's own (immutable) `type`, not by this
 * schema, since the schema itself has no `type` field to branch on. */
export const editAccountSchema = z.object({
  name: z.string().trim().min(1).max(120),
  bankName: z.string().trim().optional(),
  bankAccountNumber: z.string().trim().optional(),
  bankBranch: z.string().trim().optional(),
  mfsProvider: z.enum(MFS_PROVIDERS).optional(),
  mfsPhoneNumber: z.string().trim().optional(),
});
export type EditAccountInput = z.infer<typeof editAccountSchema>;

/** Transfer form. Mirrors `CreateTransferDto` field-for-field. `toAccountId !== fromAccountId` is
 * enforced here (`FINANCE_V2_DESIGN.md` §6 invariant: "Transfer source != destination") rather than
 * left to a 500/400 round trip. */
export const transferSchema = z
  .object({
    fromAccountId: z.string().min(1, "Select a source account"),
    toAccountId: z.string().min(1, "Select a destination account"),
    amount: z.number().min(0.01, "Amount is required"),
    feeAmount: z.number().min(0).optional(),
    transactionDate: z.string().min(1, "Date is required"),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((v) => !v.fromAccountId || !v.toAccountId || v.fromAccountId !== v.toAccountId, {
    message: "Source and destination accounts must be different",
    path: ["toAccountId"],
  });
export type TransferFormInput = z.infer<typeof transferSchema>;
