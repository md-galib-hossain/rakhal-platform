// src/config/env/app.config.ts

import { registerAs } from '@nestjs/config';
import { env } from './env';

export const appConfig = registerAs('app', () => ({
  name: env.APP_NAME,
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  apiPrefix: env.API_PREFIX,
  isProduction: env.NODE_ENV === 'production',
  appVersion: env.APP_VERSION,
  // Reverse-proxy hop count for `app.set('trust proxy', n)`. Without this,
  // req.ip is the proxy's own address (127.0.0.1 behind Nginx) for every
  // request — rate-limit buckets and audit-trail IPs all collapse into one.
  trustProxyHops: env.TRUST_PROXY_HOPS,
  // Swagger docs are dev/staging tooling only — never exposed in production,
  // and this can't be overridden by an env var (no accidental prod leak).
  swaggerEnabled: env.NODE_ENV !== 'production',
}));
