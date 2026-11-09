/** Injectable "now" so the scheduler, processor and reconcile are testable with a fake clock (RAKHAL-493). */
export const NOTIFICATION_CLOCK = Symbol('NOTIFICATION_CLOCK');

export interface NotificationClock {
  now(): Date;
}

export const systemNotificationClock: NotificationClock = {
  now: () => new Date(),
};

/** Test clock: `set` / `advance` move time explicitly. */
export class FakeNotificationClock implements NotificationClock {
  constructor(private current: Date = new Date()) {}

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(at: Date): void {
    this.current = new Date(at.getTime());
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
