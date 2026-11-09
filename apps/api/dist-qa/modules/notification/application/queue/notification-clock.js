"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NV2_FLAG = exports.FakeNotificationClock = exports.systemNotificationClock = exports.NOTIFICATION_CLOCK = void 0;
exports.NOTIFICATION_CLOCK = Symbol('NOTIFICATION_CLOCK');
exports.systemNotificationClock = {
    now: () => new Date(),
};
class FakeNotificationClock {
    current;
    constructor(current = new Date()) {
        this.current = current;
    }
    now() {
        return new Date(this.current.getTime());
    }
    set(at) {
        this.current = new Date(at.getTime());
    }
    advance(ms) {
        this.current = new Date(this.current.getTime() + ms);
    }
}
exports.FakeNotificationClock = FakeNotificationClock;
exports.NV2_FLAG = Symbol('NV2_FLAG');
//# sourceMappingURL=notification-clock.js.map