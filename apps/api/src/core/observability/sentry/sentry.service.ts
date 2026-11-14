import { Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import * as Sentry from '@sentry/node';
import { sentryConfig } from 'src/core/config/env';

@Injectable()
export class SentryService {
  initialize(config: ConfigType<typeof sentryConfig>): void {
    if (!config.enabled || !config.dsn) return;

    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,
      release: config.release,
      tracesSampleRate: config.tracesSampleRate,
    });
  }

  captureException(
    exception: unknown,
    context?: Record<string, unknown>,
  ): void {
    Sentry.withScope((scope) => {
      if (context) {
        for (const [key, value] of Object.entries(context)) {
          scope.setExtra(key, value);
        }
      }

      Sentry.captureException(exception);
    });
  }
}
