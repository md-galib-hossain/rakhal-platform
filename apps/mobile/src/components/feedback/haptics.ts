/**
 * Haptic seam (spec 2.11, Q2): a deliberate NO-OP until `expo-haptics` is approved and installed. Callers (WP5's
 * save path) call `lightImpact()` today; wiring the real module later touches only this file. Toast never calls it.
 */
export function lightImpact(): void {
  // Intentionally empty (no dependency approved).
}
