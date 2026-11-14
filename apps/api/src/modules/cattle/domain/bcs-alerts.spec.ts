import { computeBcsAlerts } from './bcs-alerts';

describe('computeBcsAlerts', () => {
  const recordedDate = new Date('2026-06-25T00:00:00Z');
  // 10 days after recordedDate → inside the ~3-week near-calving window.
  const nearCalving = new Date('2026-07-05T00:00:00Z');
  // 60 days after → outside the window.
  const farCalving = new Date('2026-08-24T00:00:00Z');

  it('raises no alerts for a healthy score with no context', () => {
    expect(computeBcsAlerts({ score: 3.0, recordedDate })).toEqual([]);
  });

  it('flags low BCS near calving (orange)', () => {
    const alerts = computeBcsAlerts({
      score: 2.25,
      recordedDate,
      expectedCalvingDate: nearCalving,
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      level: 'orange',
      code: 'bcs_low_near_calving',
    });
  });

  it('flags high BCS near calving (milk-fever risk)', () => {
    const alerts = computeBcsAlerts({
      score: 4.0,
      recordedDate,
      expectedCalvingDate: nearCalving,
    });
    expect(alerts[0]).toMatchObject({
      level: 'orange',
      code: 'bcs_high_near_calving',
    });
  });

  it('does not flag a near-calving deviation outside the 3-week window', () => {
    expect(
      computeBcsAlerts({
        score: 2.0,
        recordedDate,
        expectedCalvingDate: farCalving,
      }),
    ).toEqual([]);
  });

  it('flags an excessive drop > 1.0 point (yellow)', () => {
    const alerts = computeBcsAlerts({
      score: 2.5,
      recordedDate,
      priorScore: 3.75,
    });
    expect(alerts[0]).toMatchObject({
      level: 'yellow',
      code: 'bcs_excessive_drop',
    });
  });

  it('does not flag a drop of exactly 1.0 (threshold is strict)', () => {
    expect(
      computeBcsAlerts({ score: 2.75, recordedDate, priorScore: 3.75 }),
    ).toEqual([]);
  });

  it('can raise both a near-calving and a drop alert together', () => {
    const alerts = computeBcsAlerts({
      score: 2.25,
      recordedDate,
      expectedCalvingDate: nearCalving,
      priorScore: 3.5,
    });
    expect(alerts.map((a) => a.code)).toEqual([
      'bcs_low_near_calving',
      'bcs_excessive_drop',
    ]);
  });
});
