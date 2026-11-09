export interface LoggerContextData {
    requestId: string;
    traceId?: string;
    userId?: string;
    tenantId?: string;
    sessionId?: string;
    [key: string]: unknown;
}
export declare class LoggerContext {
    private readonly storage;
    run<T>(context: LoggerContextData, fn: () => T): T;
    get(): LoggerContextData | undefined;
    set<K extends keyof LoggerContextData>(key: K, value: LoggerContextData[K]): void;
    get requestId(): string | undefined;
    get userId(): string | undefined;
}
