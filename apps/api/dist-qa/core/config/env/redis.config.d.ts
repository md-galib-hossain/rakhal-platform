export declare const redisConfig: (() => {
    host: string;
    port: number;
    username: string | undefined;
    password: string | undefined;
    database: number;
    tlsEnabled: boolean;
    connectTimeoutMs: number;
    url: string;
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    host: string;
    port: number;
    username: string | undefined;
    password: string | undefined;
    database: number;
    tlsEnabled: boolean;
    connectTimeoutMs: number;
    url: string;
}>;
