import { SetMetadata } from '@nestjs/common';

export const SKIP_SUBSCRIPTION_KEY = 'subscription:skip';

/**
 * Exempt a route/controller from the baseline `SubscriptionGuard` (PRD §31.3):
 * billing/subscription/renewal routes must stay reachable while a farm is
 * expired so it can pay to recover.
 */
export const SkipSubscription = () => SetMetadata(SKIP_SUBSCRIPTION_KEY, true);
