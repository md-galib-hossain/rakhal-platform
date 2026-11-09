export declare const NOTIFICATION_CLOCK: unique symbol;
export interface NotificationClock {
    now(): Date;
}
export declare const systemNotificationClock: NotificationClock;
export declare class FakeNotificationClock implements NotificationClock {
    private current;
    constructor(current?: Date);
    now(): Date;
    set(at: Date): void;
    advance(ms: number): void;
}
export declare const NV2_FLAG: unique symbol;
export interface Nv2Flag {
    enabled: boolean;
}
