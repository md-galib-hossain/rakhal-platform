import {
  externalChannels,
  getEvent,
  isKnownEvent,
  NOTIFICATION_EVENTS,
} from './notification-events';

describe('notification-events catalogue', () => {
  it('has unique keys', () => {
    const keys = NOTIFICATION_EVENTS.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('marks every health_safety event non-disablable, others disablable', () => {
    for (const e of NOTIFICATION_EVENTS) {
      if (e.category === 'health_safety') expect(e.canDisable).toBe(false);
    }
    // a couple of explicit safety-critical non-health events stay mandatory too
    expect(getEvent('safety_critical_task_overdue')?.canDisable).toBe(false);
    expect(getEvent('follow_up_due_today')?.canDisable).toBe(true);
  });

  it('always enables in_app + push by default', () => {
    for (const e of NOTIFICATION_EVENTS) {
      expect(e.defaultChannels.in_app).toBe(true);
      expect(e.defaultChannels.push).toBe(true);
    }
  });

  it('resolves known vs unknown events', () => {
    expect(isKnownEvent('animal_sickness_reported')).toBe(true);
    expect(isKnownEvent('nope')).toBe(false);
  });

  it('extracts only the external (non-in_app) channels, push first', () => {
    expect(
      externalChannels({
        in_app: true,
        push: true,
        sms: true,
        whatsapp: false,
        telegram: false,
        email: true,
      }),
    ).toEqual(['push', 'sms', 'email']);
    expect(
      externalChannels({
        in_app: true,
        push: false,
        sms: false,
        whatsapp: false,
        telegram: false,
        email: false,
      }),
    ).toEqual([]);
  });
});
