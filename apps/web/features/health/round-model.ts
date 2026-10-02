import type { ProtocolRound } from "./types";

/** Needs attention first: the most late steps, then the most due today, then the soonest next step (a round with
 * nothing scheduled last), then the newest round. Used for the Running view — the server pages by date, the screen
 * wants "what should I do first". */
export function roundUrgency(a: ProtocolRound, b: ProtocolRound): number {
  if (a.stepsOverdue !== b.stepsOverdue) return b.stepsOverdue - a.stepsOverdue;
  if (a.stepsDueToday !== b.stepsDueToday) return b.stepsDueToday - a.stepsDueToday;
  if (a.nextDueDate !== b.nextDueDate) {
    if (!a.nextDueDate) return 1;
    if (!b.nextDueDate) return -1;
    return a.nextDueDate < b.nextDueDate ? -1 : 1;
  }
  return a.startDate === b.startDate ? a.roundKey.localeCompare(b.roundKey) : a.startDate < b.startDate ? 1 : -1;
}

/** Does this round need anyone's attention today (a step due or late)? */
export const needsAttention = (round: ProtocolRound): boolean => round.stepsOverdue > 0 || round.stepsDueToday > 0;

export type ProtocolsView = "running" | "library";

/** EPIC_PROTOCOL_ROUNDS D1: open on **Running** when anything is due or late, otherwise on **Library** (nothing to do
 * → the useful thing is applying a protocol). The user's own choice afterwards always wins. */
export function defaultProtocolsView(runningRounds: ProtocolRound[]): ProtocolsView {
  return runningRounds.some(needsAttention) ? "running" : "library";
}

/** How many running rounds each protocol has — the Library card's "Running on N rounds" chip. */
export function runningRoundsByPlan(runningRounds: ProtocolRound[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const round of runningRounds) counts.set(round.healthPlan.id, (counts.get(round.healthPlan.id) ?? 0) + 1);
  return counts;
}

/** 0–100 for the progress bar: done out of the steps that are not skipped. A round with no steps reads 0, never NaN. */
export function roundProgressPct(round: Pick<ProtocolRound, "stepsDone" | "stepsTotal">): number {
  return round.stepsTotal > 0 ? Math.min(100, Math.round((round.stepsDone / round.stepsTotal) * 100)) : 0;
}
