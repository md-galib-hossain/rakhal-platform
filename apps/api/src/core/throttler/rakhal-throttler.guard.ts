import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
} from '@nestjs/throttler';
import type {
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { authConfig } from 'src/core/config/env';
import type { AuthTokenPayload } from 'src/modules/auth/domain/auth-token-payload.type';

/**
 * The application-wide throttler (`APP_GUARD`).
 *
 * Overrides `getTracker` so an authenticated caller is limited **per user**
 * rather than per IP. Bangladesh mobile traffic sits behind carrier-grade NAT,
 * so IP-only keying would let one abusive account exhaust the budget for
 * everyone sharing that carrier address.
 *
 * Two constraints shape the implementation:
 *
 * 1. **Global guards run before route guards.** By the time `getTracker` is
 *    called, `JwtAuthGuard`/`SessionGuard` have not run, so `req.user` and the
 *    session context are still undefined. The token has to be read straight
 *    off the header.
 * 2. **The token must be verified, not decoded.** An unverified `decode` would
 *    be a total bypass: forge a token with a random `sub` per request and every
 *    request lands in a fresh bucket. HMAC-SHA256 verification costs
 *    microseconds and `JwtModule` is already registered globally.
 *
 * Anonymous routes (login, OTP, payment callbacks, health) fall through to IP
 * keying, which is the correct control there — and an authenticated user still
 * spends their pre-auth IP budget on the auth surface, which is what makes
 * account enumeration expensive.
 */
@Injectable()
export class RakhalThrottlerGuard extends ThrottlerGuard {
  constructor(
    // Injected by explicit token rather than by type metadata: the types have
    // to be `import type` (isolatedModules + emitDecoratorMetadata), which
    // erases the metadata Nest would otherwise resolve them from. These are
    // the same decorators the base ThrottlerGuard uses on its own constructor.
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject(authConfig.KEY)
    private readonly auth: ConfigType<typeof authConfig>,
  ) {
    super(options, storageService, reflector);
  }

  // Returns a promise to satisfy the base signature; nothing here awaits, so
  // it is deliberately not declared `async`.
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    return Promise.resolve(this.resolveTracker(req));
  }

  private resolveTracker(req: Record<string, unknown>): string {
    const headers = req.headers as Record<string, string | undefined>;
    const raw = headers?.authorization;

    if (typeof raw === 'string' && raw.startsWith('Bearer ')) {
      try {
        const payload = this.jwt.verify<AuthTokenPayload>(raw.slice(7), {
          secret: this.auth.accessSecret,
        });
        if (payload?.sub) return `u:${payload.sub}`;
      } catch {
        // Expired, forged, or malformed — fall through to IP so a garbage
        // token can't mint an unlimited supply of fresh buckets.
      }
    }

    const socket = req.socket as { remoteAddress?: string } | undefined;
    return `ip:${(req.ip as string) ?? socket?.remoteAddress ?? 'unknown'}`;
  }
}
