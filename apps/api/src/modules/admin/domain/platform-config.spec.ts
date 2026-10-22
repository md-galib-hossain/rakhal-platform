import {
  CONFIG_KEY_PATTERN,
  isFeatureEnabled,
  looksLikeSecretKey,
  MAX_SETTING_JSON_BYTES,
  settingValueProblem,
} from './platform-config';

describe('isFeatureEnabled', () => {
  it('is off for an unknown flag', () => {
    expect(isFeatureEnabled(null, 'f1')).toBe(false);
    expect(isFeatureEnabled(undefined)).toBe(false);
  });
  it('is on globally when enabled', () => {
    expect(isFeatureEnabled({ enabled: true, farmIds: [] })).toBe(true);
    expect(isFeatureEnabled({ enabled: true, farmIds: [] }, 'any')).toBe(true);
  });
  it('is on only for allow-listed farms when disabled', () => {
    const flag = { enabled: false, farmIds: ['f1'] };
    expect(isFeatureEnabled(flag, 'f1')).toBe(true);
    expect(isFeatureEnabled(flag, 'f2')).toBe(false);
    expect(isFeatureEnabled(flag)).toBe(false);
    expect(isFeatureEnabled(flag, null)).toBe(false);
  });
});

describe('config keys', () => {
  it.each(['milk.v2', 'new_dashboard', 'abc', 'a-b.c_d1'])(
    'accepts %s',
    (k) => {
      expect(CONFIG_KEY_PATTERN.test(k)).toBe(true);
    },
  );
  it.each(['ab', 'Upper', '1abc', 'has space', 'x'.repeat(65), 'bad/key', ''])(
    'rejects %s',
    (k) => {
      expect(CONFIG_KEY_PATTERN.test(k)).toBe(false);
    },
  );
});

describe('looksLikeSecretKey', () => {
  it.each([
    'smtp.password',
    'bkash_app_secret',
    'api_key',
    'telegram.token',
    'private.cert',
    'db-credential',
  ])('flags %s', (k) => expect(looksLikeSecretKey(k)).toBe(true));
  it.each([
    'milk.max_litres',
    'trial.days',
    'maintenance.banner',
    'keyboard.layout',
  ])('allows %s', (k) => expect(looksLikeSecretKey(k)).toBe(false));
});

describe('settingValueProblem', () => {
  it('accepts plain JSON', () => {
    expect(settingValueProblem(10)).toBeNull();
    expect(settingValueProblem({ a: [1, 2] })).toBeNull();
    expect(settingValueProblem(null)).toBeNull();
    expect(settingValueProblem('')).toBeNull();
  });
  it('rejects undefined and oversized values', () => {
    expect(settingValueProblem(undefined)).toMatch(/required/);
    expect(settingValueProblem('x'.repeat(MAX_SETTING_JSON_BYTES + 1))).toMatch(
      /at most/,
    );
  });
  it('rejects non-serialisable values', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(settingValueProblem(cyclic)).toMatch(/serialisable/);
    expect(settingValueProblem(() => 1)).toMatch(/serialisable/);
  });
});
