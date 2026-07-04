/**
 * Rakhal Credit policy (PRD §37) — the single source of truth for how the
 * closed-loop `CreditWallet` behaves. **Rakhal Credit is store credit**, not
 * cash: it is *earned* (referral rewards today; promos/refund-to-credit later)
 * and *spent* on Rakhal's own paid surfaces. It is distinct from the Finance
 * cash wallet (`WalletTransaction`), which tracks a farm's real money.
 *
 * The whole point of this file is that the owner's product decisions here are a
 * **config flip, not a code change** (the user's directive: "he can't cash the
 * money now, but maybe later — make it feasible + easy to configure").
 */

/** A Rakhal paid surface that a farm can spend credit on. */
export type CreditSpendSurface =
  | 'subscription' // §32 billing — live today
  | 'consultation' // §38.1 Rakhal Doctors — future
  | 'marketplace' // §38.2 Rakhal Marketplace — future
  | 'cattle_trade'; // §38.3 Cattle Trading — future

export interface CreditPolicy {
  /**
   * **Master cash-out switch.** `false` = closed-loop only: credit can be spent
   * on Rakhal but never withdrawn as money (launch decision, CRD-05). Flip to
   * `true` **only** once the payout path (rails + KYC + threshold + admin
   * approval, RD-018) exists — the `ReferralCommission.rewardType = CASH`
   * ledger is already built for it. `CreditWalletService.assertCashOutEnabled`
   * is the one gate every future payout path must call.
   */
  cashOutEnabled: boolean;

  /**
   * Surfaces credit may be spent on today. Adding a surface here (once its
   * module calls `CreditWalletService.debit`) is the only change needed to let
   * credit pay for it — no wallet rework. Kept explicit so an unbuilt surface
   * can't silently accept credit.
   */
  spendableSurfaces: CreditSpendSurface[];
}

/**
 * Launch policy: closed-loop, cash-out OFF, subscription the only live spend
 * surface. Doctors / Marketplace / Cattle-Trade get added as each ships (§38).
 * Kept in code (like the referral program defaults) until the platform-admin
 * config store lands (RAKHAL-224/225, RD-026).
 */
export const DEFAULT_CREDIT_POLICY: CreditPolicy = {
  cashOutEnabled: false,
  spendableSurfaces: ['subscription'],
};
