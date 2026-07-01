import { summarizeProtocol } from './protocol-metrics';

const inst = (
  status: string,
  aiCompletedAt: Date | null = null,
  pregnancyOutcome: string | null = null,
) => ({ status, aiCompletedAt, pregnancyOutcome });

describe('summarizeProtocol', () => {
  it('counts an empty protocol as zero with null conception rate', () => {
    const m = summarizeProtocol([]);
    expect(m.applied).toBe(0);
    expect(m.conception_rate).toBeNull();
  });

  it('splits protocol status from pregnancy outcome', () => {
    const now = new Date();
    const m = summarizeProtocol([
      inst('IN_PROGRESS'),
      inst('SCHEDULED'),
      inst('COMPLETED', now, 'PREGNANT'),
      inst('COMPLETED', now, 'OPEN'),
      inst('COMPLETED', now, 'PREGNANCY_LOSS'),
      inst('CANCELLED'),
    ]);
    expect(m.applied).toBe(6);
    expect(m.in_progress).toBe(2); // IN_PROGRESS + SCHEDULED (not CANCELLED)
    expect(m.completed).toBe(3);
    expect(m.ai_completed).toBe(3);
    expect(m.pregnant).toBe(1);
    expect(m.open).toBe(1);
    expect(m.pregnancy_loss).toBe(1);
  });

  it('computes conception rate = pregnant ÷ completed', () => {
    const now = new Date();
    // 71 pregnant of 124 completed → 57.3%
    const completed = Array.from({ length: 124 }, (_, k) =>
      inst('COMPLETED', now, k < 71 ? 'PREGNANT' : 'OPEN'),
    );
    const m = summarizeProtocol([...completed, inst('IN_PROGRESS')]);
    expect(m.completed).toBe(124);
    expect(m.pregnant).toBe(71);
    expect(m.conception_rate).toBe(57.3);
  });

  it('AI-completed counts the milestone independently of final status', () => {
    const now = new Date();
    const m = summarizeProtocol([inst('COMPLETED', now, 'WAITING_PD')]);
    expect(m.ai_completed).toBe(1);
    expect(m.pregnant).toBe(0);
    expect(m.conception_rate).toBe(0);
  });
});
