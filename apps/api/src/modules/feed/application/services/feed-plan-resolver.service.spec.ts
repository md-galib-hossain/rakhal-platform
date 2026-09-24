import { AssignmentRow, pickProgram } from './feed-plan-resolver.service';

/** RAKHAL-456 — pure precedence: individual → group → herd → none (ADR-027 D5/D6). */
describe('pickProgram', () => {
  const row = (
    id: string,
    targetType: AssignmentRow['targetType'],
    over: Partial<AssignmentRow> = {},
  ): AssignmentRow => ({
    id,
    targetType,
    cattleId: targetType === 'INDIVIDUAL' ? 'cow' : null,
    animalGroupId: targetType === 'GROUP' ? `g-${id}` : null,
    appliedAt: new Date('2026-09-01T00:00:00Z'),
    plan: { id: `plan-${id}`, name: `Plan ${id}`, kind: 'PLAN', lines: [] },
    ...over,
  });

  it('resolves nothing when no program applies', () => {
    expect(pickProgram(undefined, [], undefined)).toBeNull();
  });

  it('herd default applies when nothing more specific does', () => {
    const p = pickProgram(undefined, [], row('h', 'HERD'));
    expect(p).toMatchObject({ via: 'HERD', planId: 'plan-h', conflict: false });
  });

  it('group beats herd', () => {
    const p = pickProgram(undefined, [row('g1', 'GROUP')], row('h', 'HERD'));
    expect(p).toMatchObject({
      via: 'GROUP',
      planId: 'plan-g1',
      groupId: 'g-g1',
      conflict: false,
    });
  });

  it('individual beats group and herd', () => {
    const p = pickProgram(
      row('i', 'INDIVIDUAL'),
      [row('g1', 'GROUP')],
      row('h', 'HERD'),
    );
    expect(p).toMatchObject({ via: 'INDIVIDUAL', planId: 'plan-i' });
    expect(p?.groupId).toBeUndefined();
  });

  it('two groups: the most recently applied wins and the conflict is flagged', () => {
    const older = row('g1', 'GROUP', {
      appliedAt: new Date('2026-09-01T00:00:00Z'),
    });
    const newer = row('g2', 'GROUP', {
      appliedAt: new Date('2026-09-10T00:00:00Z'),
    });
    const p = pickProgram(undefined, [older, newer], undefined);
    expect(p).toMatchObject({ planId: 'plan-g2', conflict: true });
  });

  it('an individual program hides a group overlap (no conflict flag)', () => {
    const p = pickProgram(
      row('i', 'INDIVIDUAL'),
      [row('g1', 'GROUP'), row('g2', 'GROUP')],
      undefined,
    );
    expect(p).toMatchObject({ via: 'INDIVIDUAL', conflict: false });
  });

  it('the same group listed twice is not a conflict', () => {
    const a = row('g1', 'GROUP', { animalGroupId: 'same' });
    const b = row('g1b', 'GROUP', { animalGroupId: 'same' });
    expect(pickProgram(undefined, [a, b], undefined)?.conflict).toBe(false);
  });
});
