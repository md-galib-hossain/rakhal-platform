/**
 * Recipe-line identity (MILESTONE 26, RAKHAL-447, ADR-026 D7). A line backed by an inventory product
 * (`feedItemId`) is keyed by that product — plus the pinned lot when there is one — because its
 * nutrition and price come from the lot, not the catalogue; any other line is keyed by its catalogue
 * ingredient. Distinct keys mean a lot-backed line and a catalogue line of the same ingredient can
 * share one lookup map without colliding. Pure — no framework/Prisma.
 */
export interface RecipeLineRef {
  ingredientId: string | null;
  feedItemId: string | null;
  feedItemBatchId?: string | null;
}

export function lineKey(line: RecipeLineRef): string {
  if (line.feedItemId) {
    return line.feedItemBatchId
      ? `${line.feedItemId}:${line.feedItemBatchId}`
      : line.feedItemId;
  }
  if (!line.ingredientId) {
    throw new Error('A recipe line needs an ingredientId or a feedItemId');
  }
  return line.ingredientId;
}

/** True when the line's nutrition comes from an inventory lot rather than the catalogue (D7). */
export const isLotBacked = (line: RecipeLineRef): boolean =>
  line.feedItemId != null;
