export declare const loggingConfig: (() => {
    level: "error" | "warn" | "info" | "debug" | "verbose";
    format: "json" | "pretty";
    requestLogging: boolean;
    dbLogging: boolean;
    httpLogging: boolean;
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    level: "error" | "warn" | "info" | "debug" | "verbose";
    format: "json" | "pretty";
    requestLogging: boolean;
    dbLogging: boolean;
    httpLogging: boolean;
}>;
