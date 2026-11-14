import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedHttpRequest } from 'src/modules/auth/domain/authenticated-http-request.type';
import { SKIP_SUBSCRIPTION_KEY } from '../decorators/skip-subscription.decorator';
import {
  Entitlement,
  SubscriptionAccessService,
} from '../../application/services/subscription-access.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

type RequestWithEntitlement = AuthenticatedHttpRequest & {
  entitlement?: Entitlement;
};

/**
 * Baseline subscription gate (RAKHAL-218, PRD §31.3). Place **after**
 * `FarmContextGuard` in the chain so `req.farm` is resolved.
 *
 * Rules: `ACTIVE`/`TRIALING` → full access; every other state (`PAST_DUE`
 * grace, `EXPIRED`, `CANCELLED`, no subscription) → **read-only** (safe methods
 * pass, mutations 403). Reads always work so data is never locked away (SUB-04).
 *
 * Efficiency: the entitlement is resolved once (a cached Redis read) and
 * **memoized on the request** so the feature guard / limit checks reuse it.
 * Routes that must work while expired (billing, renewal) opt out with
 * `@SkipSubscription()`.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: SubscriptionAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_SUBSCRIPTION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) {
      return true;
    }

    const req = context.switchToHttp().getRequest<RequestWithEntitlement>();

    // Not farm-scoped (public / pre-farm-context route) — nothing to gate.
    if (!req.farm) {
      return true;
    }

    const entitlement =
      req.entitlement ??
      (req.entitlement = await this.access.resolveEntitlement(req.farm.farmId));

    if (entitlement.status === 'ACTIVE' || entitlement.status === 'TRIALING') {
      return true;
    }

    // Read-only for every other state.
    if (SAFE_METHODS.has(req.method)) {
      return true;
    }

    throw new ForbiddenException(this.blockMessage(entitlement.status));
  }

  private blockMessage(status: Entitlement['status']): string {
    switch (status) {
      case 'PAST_DUE':
        return 'Subscription payment is past due — renew to make changes.';
      case 'EXPIRED':
        return 'Subscription has expired — renew to make changes.';
      case 'CANCELLED':
        return 'Subscription is cancelled — resubscribe to make changes.';
      default:
        return 'An active subscription is required to make changes.';
    }
  }
}
