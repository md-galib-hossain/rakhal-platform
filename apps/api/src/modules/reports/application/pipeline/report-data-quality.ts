import type { DataQuality } from '../../domain/contracts/data-quality';

export const emptyDataQuality = (): DataQuality => ({
  coverage: { expected: 0, recorded: 0 },
  notes: [],
  flags: {
    incompleteCoverage: false,
    hasUnsubmittedDrafts: false,
    hasEstimatedValues: false,
    hasUnknownCosts: false,
    groupMembershipCurrentOnly: false,
  },
});

/** Sum coverage, union notes (first-seen order) and OR every flag. Pure; inputs are not mutated. */
export function mergeDataQuality(parts: readonly DataQuality[]): DataQuality {
  const out = emptyDataQuality();
  const notes = new Set<string>();
  for (const p of parts) {
    out.coverage.expected += p.coverage.expected;
    out.coverage.recorded += p.coverage.recorded;
    for (const n of p.notes) notes.add(n);
    out.flags.incompleteCoverage ||= p.flags.incompleteCoverage;
    out.flags.hasUnsubmittedDrafts ||= p.flags.hasUnsubmittedDrafts;
    out.flags.hasEstimatedValues ||= p.flags.hasEstimatedValues;
    out.flags.hasUnknownCosts ||= p.flags.hasUnknownCosts;
    out.flags.groupMembershipCurrentOnly ||= p.flags.groupMembershipCurrentOnly;
  }
  out.notes = [...notes];
  return out;
}
