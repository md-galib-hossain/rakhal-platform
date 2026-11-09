export declare const sentryConfig: (() => {
    dsn: string | undefined;
    environment: string;
    release: string;
    tracesSampleRate: number;
    enabled: boolean;
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    dsn: string | undefined;
    environment: string;
    release: string;
    tracesSampleRate: number;
    enabled: boolean;
}>;
