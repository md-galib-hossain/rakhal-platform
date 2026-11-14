import type { ConfigType } from '@nestjs/config';
import type { CookieOptions } from 'express';
import { authConfig } from '../config/env';

type AuthConfig = ConfigType<typeof authConfig>;

export function getRefreshCookieOptions(config: AuthConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: config.refreshCookie.secure,
    sameSite: config.refreshCookie.sameSite,
    domain: config.refreshCookie.domain,
    path: config.refreshCookie.path,
    maxAge: parseDurationToMs(config.refreshExpiresIn),
  };
}

export function getClearRefreshCookieOptions(
  config: AuthConfig,
): CookieOptions {
  const options = getRefreshCookieOptions(config);
  delete options.maxAge;

  return options;
}

export function getCsrfCookieOptions(config: AuthConfig): CookieOptions {
  return {
    httpOnly: false,
    secure: config.csrf.cookieSecure,
    sameSite: config.csrf.cookieSameSite,
    path: config.csrf.cookiePath,
  };
}

function parseDurationToMs(value: string): number | undefined {
  const match = /^(?<amount>\d+)(?<unit>ms|s|m|h|d)$/i.exec(value.trim());
  if (!match?.groups) {
    return undefined;
  }

  const amount = Number(match.groups.amount);
  const unit = match.groups.unit.toLowerCase();
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
}
