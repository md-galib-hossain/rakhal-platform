/**
 * Optional font-scale override (gallery scale control, tests). When present, <Text> disables RN font scaling and
 * multiplies sizes itself by min(override, role cap). Absent (null) = follow the system font scale with caps.
 */
import { createContext, useContext, type ReactNode } from 'react';

const TextScaleContext = createContext<number | null>(null);

export function TextScaleProvider({ scale, children }: { scale: number; children: ReactNode }) {
  return <TextScaleContext.Provider value={scale}>{children}</TextScaleContext.Provider>;
}

/** The override scale, or undefined when none is set. */
export function useTextScaleOverride(): number | undefined {
  return useContext(TextScaleContext) ?? undefined;
}
