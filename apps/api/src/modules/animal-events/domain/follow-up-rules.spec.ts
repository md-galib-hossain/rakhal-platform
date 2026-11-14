import {
  planFollowUps,
  RuleDefaults,
  RuleEvent,
  rulesCompletedBy,
} from './follow-up-rules';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);
const defaults: RuleDefaults = {
  pregnancyCheckDays: 35,
  vwpDays: 60,
  dryPeriodDays: 60,
  closeUpDays: 21,
};
const now = d('2026-10-30');

describe('planFollowUps (RAKHAL-484)', () => {
  it('AI creates a preg check after the farm setting', () => {
    const ev: RuleEvent = {
      type: 'BREEDING',
      eventAt: d('2026-10-29'),
      payload: {},
    };
    const plan = planFollowUps(ev, defaults, {}, now);
    expect(plan).toHaveLength(1);
    expect(plan[0].ruleKey).toBe('BREEDING_TO_PREG_CHECK');
    expect(iso(plan[0].dueDate)).toBe('2026-12-03');
    expect(plan[0].pastDue).toBe(false);
  });

  it('a farm offset and an off switch are honoured', () => {
    const ev: RuleEvent = {
      type: 'BREEDING',
      eventAt: d('2026-10-29'),
      payload: {},
    };
    const p = planFollowUps(
      ev,
      defaults,
      { BREEDING_TO_PREG_CHECK: { offsetDays: 28 } },
      now,
    );
    expect(iso(p[0].dueDate)).toBe('2026-11-26');
    expect(
      planFollowUps(
        ev,
        defaults,
        { BREEDING_TO_PREG_CHECK: { enabled: false } },
        now,
      ),
    ).toHaveLength(0);
  });

  it('a back-dated AI is past due and is flagged, never silently created', () => {
    const ev: RuleEvent = {
      type: 'BREEDING',
      eventAt: d('2026-08-01'),
      payload: {},
    };
    expect(planFollowUps(ev, defaults, {}, now)[0].pastDue).toBe(true);
  });

  it('a positive check with an expected calving date gives dry-off and calving watch', () => {
    const ev: RuleEvent = {
      type: 'PREG_CHECK',
      eventAt: d('2026-10-29'),
      payload: {},
      result: 'PREGNANT',
      expectedCalvingDate: d('2027-05-20'),
    };
    const keys = planFollowUps(ev, defaults, {}, now).map((p) => [
      p.ruleKey,
      iso(p.dueDate),
    ]);
    expect(keys).toEqual([
      ['PREG_POSITIVE_TO_DRY_OFF', '2027-03-21'],
      ['PREG_POSITIVE_TO_CALVING_WATCH', '2027-04-29'],
    ]);
  });

  it('a positive check with no expected date gives nothing; a suspected one gives a recheck', () => {
    expect(
      planFollowUps(
        {
          type: 'PREG_CHECK',
          eventAt: d('2026-10-29'),
          payload: {},
          result: 'PREGNANT',
        },
        defaults,
        {},
        now,
      ),
    ).toHaveLength(0);
    const r = planFollowUps(
      {
        type: 'PREG_CHECK',
        eventAt: d('2026-10-29'),
        payload: {},
        result: 'SUSPECTED',
      },
      defaults,
      {},
      now,
    );
    expect(r.map((x) => x.ruleKey)).toEqual(['SUSPECTED_TO_RECHECK']);
    expect(iso(r[0].dueDate)).toBe('2026-11-08');
  });

  it('calving ends the waiting period after reproVwpDays', () => {
    const r = planFollowUps(
      { type: 'CALVING', eventAt: d('2026-10-29'), payload: {} },
      defaults,
      {},
      now,
    );
    expect(r[0].ruleKey).toBe('CALVING_TO_VWP_END');
    expect(iso(r[0].dueDate)).toBe('2026-12-28');
  });

  it('vaccination next dose needs nextDoseDays', () => {
    const base = { type: 'VACCINATION' as const, eventAt: d('2026-10-29') };
    expect(
      planFollowUps({ ...base, payload: {} }, defaults, {}, now),
    ).toHaveLength(0);
    const r = planFollowUps(
      { ...base, payload: { nextDoseDays: 28 } },
      defaults,
      {},
      now,
    );
    expect(iso(r[0].dueDate)).toBe('2026-11-26');
  });

  it('heat gives a suggestion, never a task', () => {
    const r = planFollowUps(
      { type: 'HEAT', eventAt: d('2026-10-30'), payload: {} },
      defaults,
      {},
      now,
    );
    expect(r[0]).toMatchObject({
      ruleKey: 'HEAT_TO_BREED_SUGGESTION',
      kind: 'SUGGESTION',
      pastDue: false,
    });
  });

  it('an early or matching event closes the follow-up', () => {
    expect(rulesCompletedBy('PREG_CHECK')).toEqual(
      expect.arrayContaining([
        'BREEDING_TO_PREG_CHECK',
        'SUSPECTED_TO_RECHECK',
      ]),
    );
    expect(rulesCompletedBy('CALVING')).toEqual(
      expect.arrayContaining([
        'PREG_POSITIVE_TO_DRY_OFF',
        'PREG_POSITIVE_TO_CALVING_WATCH',
      ]),
    );
    expect(rulesCompletedBy('BREEDING')).toEqual(
      expect.arrayContaining([
        'CALVING_TO_VWP_END',
        'HEAT_TO_BREED_SUGGESTION',
      ]),
    );
  });
});
