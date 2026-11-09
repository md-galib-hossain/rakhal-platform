export declare const appConfig: (() => {
    name: string;
    port: number;
    nodeEnv: "development" | "production" | "test";
    apiPrefix: string;
    isProduction: boolean;
    appVersion: string;
    trustProxyHops: number;
    swaggerEnabled: boolean;
    allowedOrigins: string[];
    metricsToken: string | undefined;
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    name: string;
    port: number;
    nodeEnv: "development" | "production" | "test";
    apiPrefix: string;
    isProduction: boolean;
    appVersion: string;
    trustProxyHops: number;
    swaggerEnabled: boolean;
    allowedOrigins: string[];
    metricsToken: string | undefined;
}>;
