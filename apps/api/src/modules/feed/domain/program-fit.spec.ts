import {
  bandsFromSettings,
  classifyDelta,
  computeProgramFit,
} from './program-fit';
import { DEFAULT_REQUIREMENT_SETTINGS } from './requirement-settings';

describe('classifyDelta', () => {
  it('is ok inside the band, on either side', () => {
    expect(classifyDelta(100, 100, 10, 10).severity).toBe('ok');
    expect(classifyDelta(91, 100, 10, 10).severity).toBe('ok');
    expect(classifyDelta(110, 100, 10, 10).severity).toBe('ok');
  });

  it('warns up to twice the band, then goes bad', () => {
    expect(classifyDelta(85, 100, 10, 10).severity).toBe('warn'); // -15 %
    expect(classifyDelta(80, 100, 10, 10).severity).toBe('warn'); // -20 % (edge)
    expect(classifyDelta(79, 100, 10, 10).severity).toBe('bad');
    expect(classifyDelta(115, 100, 10, 10).severity).toBe('warn');
    expect(classifyDelta(121, 100, 10, 10).severity).toBe('bad');
  });

  it('uses separate bands for shortfall and excess', () => {
    // Protein default: -10 % / +20 %. +15 % is fine, -15 % is a warning.
    expect(classifyDelta(115, 100, 10, 20).severity).toBe('ok');
    expect(classifyDelta(85, 100, 10, 20).severity).toBe('warn');
    expect(classifyDelta(145, 100, 10, 20).severity).toBe('bad');
  });

  it('reports the delta to one decimal, and is ok with a null delta for a zero requirement', () => {
    expect(classifyDelta(86.26, 100, 10, 10).deltaPct).toBe(-13.7);
    expect(classifyDelta(5, 0, 10, 10)).toEqual({
      deltaPct: null,
      severity: 'ok',
    });
  });
});

describe('computeProgramFit', () => {
  const bands = bandsFromSettings(DEFAULT_REQUIREMENT_SETTINGS);
  const need = { dmKg: 14, cpKg: 2.2, meMj: 150 };

  it('takes the worst nutrient as the overall severity', () => {
    const fit = computeProgramFit(
      { dmKg: 14, cpKg: 1.5, meMj: 150 }, // protein -31.8 % -> bad
      need,
      bands,
      false,
    );
    expect(fit.dm.severity).toBe('ok');
    expect(fit.cp.severity).toBe('bad');
    expect(fit.severity).toBe('bad');
    expect(fit.estimated).toBe(false);
  });

  it('a perfect program is ok everywhere', () => {
    const fit = computeProgramFit(need, need, bands, false);
    expect(fit.severity).toBe('ok');
  });

  it('carries the estimated flag through unchanged', () => {
    expect(computeProgramFit(need, need, bands, true).estimated).toBe(true);
  });

  it('maps the farm settings onto the bands', () => {
    expect(bands).toEqual({
      dmBelowPct: 10,
      dmAbovePct: 10,
      cpBelowPct: 10,
      cpAbovePct: 20,
      meBelowPct: 10,
      meAbovePct: 10,
    });
  });
});
