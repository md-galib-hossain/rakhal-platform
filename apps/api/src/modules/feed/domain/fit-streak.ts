/**
 * "Off target three days running" (MILESTONE 27, RAKHAL-459b). Pure: no framework, no Prisma.
 *
 * A day counts against a cow only when her fit was `WARN` or `BAD` **and** measured. An `estimated` day (an input
 * was assumed) never counts, and a missing day breaks the streak — the digest must not nag on a guess.
 */

export interface FitDayRow {
  cattleId: string;
  /** Calendar date, `YYYY-MM-DD`. */
  date: string;
  severity: 'OK' | 'WARN' | 'BAD';
  estimated: boolean;
}

/** The `days` calendar dates ending at `endYmd` (newest first): `endYmd`, the day before, … */
export function streakDates(endYmd: string, days: number): string[] {
  const end = new Date(`${endYmd}T00:00:00.000Z`).getTime();
  return Array.from({ length: days }, (_, i) =>
    new Date(end - i * 86_400_000).toISOString().slice(0, 10),
  );
}

/** Cows that were measured-and-off-target on **every** one of `dates`. */
export function offTargetCows(rows: FitDayRow[], dates: string[]): string[] {
  const badDays = new Map<string, Set<string>>();
  for (const r of rows) {
    if (r.estimated || r.severity === 'OK') continue;
    if (!dates.includes(r.date)) continue;
    const set = badDays.get(r.cattleId) ?? new Set<string>();
    set.add(r.date);
    badDays.set(r.cattleId, set);
  }
  return [...badDays.entries()]
    .filter(([, days]) => days.size === dates.length)
    .map(([cattleId]) => cattleId)
    .sort();
}
