/** Mirrors backend matching: "*", exact, or "resource.*" wildcard. */
export function canDo(granted: readonly string[], required: string | undefined): boolean {
  if (!required) return true;
  if (granted.includes("*") || granted.includes(required)) return true;
  const [resource] = required.split(".");
  return granted.includes(`${resource}.*`);
}

export type GateResult = { allowed: true } | { allowed: false; reason: "forbidden" };

/** Pure route gate (BusinessOS judgeGate pattern, minus tenant modules). */
export function judgeGate(granted: readonly string[], perm?: string): GateResult {
  return canDo(granted, perm) ? { allowed: true } : { allowed: false, reason: "forbidden" };
}
