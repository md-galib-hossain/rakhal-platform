/** How complete the data behind a report is. Surfaced to the user; never silently "fixed". */
export interface DataQuality {
  /** expected vs recorded entries (e.g. cow-days with a milk log). */
  coverage: { expected: number; recorded: number };
  notes: string[];
  flags: DataQualityFlags;
}

export interface DataQualityFlags {
  incompleteCoverage: boolean;
  /** Unsubmitted milk drafts existed for the period (excluded, decision 7). */
  hasUnsubmittedDrafts: boolean;
  /** Some figure used an assumption. */
  hasEstimatedValues: boolean;
  /** Pre-RAKHAL-441 feed `costTk` null = unknown, not zero. */
  hasUnknownCosts: boolean;
  /** GROUP scope: membership is as of generation, not as of the period. */
  groupMembershipCurrentOnly: boolean;
}
