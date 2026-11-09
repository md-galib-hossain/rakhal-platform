import { ConfigType } from '@nestjs/config';
import { sentryConfig } from 'src/core/config/env';
export declare class SentryService {
    initialize(config: ConfigType<typeof sentryConfig>): void;
    captureException(exception: unknown, context?: Record<string, unknown>): void;
}
