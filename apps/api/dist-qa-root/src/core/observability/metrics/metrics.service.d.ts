export declare class MetricsService {
    private readonly registry;
    private readonly httpRequestsTotal;
    private readonly httpRequestDurationMs;
    private readonly httpErrorsTotal;
    private readonly authFailuresTotal;
    private readonly notificationOccurrenceTotal;
    private readonly notificationFireLagSeconds;
    private readonly notificationReconcileTotal;
    private readonly notificationQueueDelayed;
    constructor();
    recordNotificationOccurrence(outcome: 'fired' | 'skipped' | 'cancelled', reason?: string): void;
    observeNotificationFireLag(seconds: number): void;
    recordNotificationReconcile(action: 'enqueued' | 'removed' | 'advanced' | 'purged', count?: number): void;
    setNotificationQueueDelayed(count: number): void;
    recordHttpRequest(labels: {
        method: string;
        route: string;
        status: string;
    }, durationMs: number): void;
    recordHttpError(route: string, status: number, errorCode: string): void;
    recordAuthFailure(reason: string, route: string): void;
    getMetrics(): Promise<string>;
    getContentType(): string;
}
