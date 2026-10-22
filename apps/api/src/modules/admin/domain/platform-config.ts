/** Keys for flags and settings: lower-case, start with a letter, 3-64 chars of `a-z 0-9 _ . -`. */
export const CONFIG_KEY_PATTERN = /^[a-z][a-z0-9_.-]{2,63}$/;

export const MAX_SETTING_JSON_BYTES = 4000;

const SECRET_LOOKING_KEY =
  /pass(word)?|secret|token|credential|private|api[_.-]?key|(^|[_.-])key($|[_.-])/i;

/** Platform settings are for tunable, non-secret values; refuse anything that looks like a credential. */
export function looksLikeSecretKey(key: string): boolean {
  return SECRET_LOOKING_KEY.test(key);
}

/** Why a setting value is unacceptable, or null when it is fine. */
export function settingValueProblem(value: unknown): string | null {
  if (value === undefined) return 'value is required';
  let json: string;
  try {
    json = JSON.stringify(value);
  } catch {
    return 'value must be JSON-serialisable';
  }
  if (json === undefined) return 'value must be JSON-serialisable';
  if (Buffer.byteLength(json, 'utf8') > MAX_SETTING_JSON_BYTES) {
    return `value must be at most ${MAX_SETTING_JSON_BYTES} bytes of JSON`;
  }
  return null;
}

/**
 * A flag is on globally (`enabled`) or for an allow-listed farm (`farmIds`). An unknown flag is off — callers
 * never need a "does it exist" check, so a missing row fails safe.
 */
export function isFeatureEnabled(
  flag: { enabled: boolean; farmIds: readonly string[] } | null | undefined,
  farmId?: string | null,
): boolean {
  if (!flag) return false;
  if (flag.enabled) return true;
  return !!farmId && flag.farmIds.includes(farmId);
}
