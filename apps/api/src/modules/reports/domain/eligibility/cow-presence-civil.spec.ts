import { evaluatePresence } from './cow-presence';

const d = (s: string) => new Date(s);
const gen = d('2026-11-30T00:00:00Z');
const created = d('2025-01-01T00:00:00Z');

// Dhaka (UTC+6) October 2026.
const dhaka = {
  start: d('2026-09-30T18:00:00Z'),
  end: d('2026-10-31T18:00:00Z'),
  startDate: '2026-10-01',
  endDate: '2026-10-31',
};
// New York (EDT, UTC-4) October 2026.
const ny = {
  start: d('2026-10-01T04:00:00Z'),
  end: d('2026-11-01T04:00:00Z'),
  startDate: '2026-10-01',
  endDate: '2026-10-31',
};

describe('cow presence: date-only fields compare on the farm civil date', () => {
  it('America/New_York: disposition on Oct 1 (UTC midnight) is present', () => {
    const dispositionDate = d('2026-10-01T00:00:00Z');
    expect(
      evaluatePresence({ createdAt: created, dispositionDate }, ny, gen)
        .present,
    ).toBe(true);
    // Legacy instant compare (no civil dates) wrongly drops it: the off-by-one being fixed.
    expect(
      evaluatePresence(
        { createdAt: created, dispositionDate },
        { start: ny.start, end: ny.end },
        gen,
      ).present,
    ).toBe(false);
  });

  it('America/New_York: disposition Sep 30 is absent', () => {
    expect(
      evaluatePresence(
        { createdAt: created, dispositionDate: d('2026-09-30T00:00:00Z') },
        ny,
        gen,
      ),
    ).toMatchObject({ present: false, reason: 'exited_before_period' });
  });

  it('America/New_York: enteredAt on the last civil day is present, next day absent', () => {
    expect(
      evaluatePresence(
        { createdAt: created, enteredAt: d('2026-10-31T00:00:00Z') },
        ny,
        gen,
      ).present,
    ).toBe(true);
    expect(
      evaluatePresence(
        { createdAt: created, enteredAt: d('2026-11-01T00:00:00Z') },
        ny,
        gen,
      ),
    ).toMatchObject({ present: false, reason: 'entered_after_period' });
  });

  it('Asia/Dhaka: boundaries on both ends', () => {
    const p = (o: object) =>
      evaluatePresence({ createdAt: created, ...o }, dhaka, gen);
    expect(p({ dispositionDate: d('2026-10-01T00:00:00Z') }).present).toBe(
      true,
    );
    expect(p({ dispositionDate: d('2026-09-30T00:00:00Z') }).present).toBe(
      false,
    );
    expect(p({ enteredAt: d('2026-10-31T00:00:00Z') }).present).toBe(true);
    expect(p({ enteredAt: d('2026-11-01T00:00:00Z') }).present).toBe(false);
  });

  it('createdAt stays an instant comparison (true timestamp)', () => {
    const at = d('2026-10-31T20:00:00Z'); // Nov 1 02:00 Dhaka, Oct 31 16:00 New York
    expect(evaluatePresence({ createdAt: at }, dhaka, gen)).toMatchObject({
      present: false,
      reason: 'entered_after_period',
    });
    expect(evaluatePresence({ createdAt: at }, ny, gen).present).toBe(true);
  });
});
