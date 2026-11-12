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

