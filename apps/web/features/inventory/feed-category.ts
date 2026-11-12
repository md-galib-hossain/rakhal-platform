import type { FeedClass, FeedSubType } from "./types";

/** One entry in the single "Category" picker. `value` is either a `FeedSubType` or a `CLASS_*` key
 * for a class-level entry with no subtype (e.g. Mineral, Vitamin, or a generic "Other forage"). */
export interface FeedCategoryOption {
  value: string;
  feedClass: FeedClass;
  feedSubType?: FeedSubType;
}

export interface FeedCategoryGroup {
  feedClass: FeedClass;
  options: FeedCategoryOption[];
}

const sub = (feedClass: FeedClass, feedSubType: FeedSubType): FeedCategoryOption => ({
  value: feedSubType,
  feedClass,
  feedSubType,
});
const generic = (feedClass: FeedClass): FeedCategoryOption => ({ value: `CLASS_${feedClass}`, feedClass });

export const FEED_CATEGORY_GROUPS: FeedCategoryGroup[] = [
  {
    feedClass: "FORAGE",
    options: [
      sub("FORAGE", "GREEN_FODDER"),
      sub("FORAGE", "SILAGE"),
      sub("FORAGE", "HAY"),
      sub("FORAGE", "STRAW"),
      sub("FORAGE", "ROUGHAGE"),
      generic("FORAGE"),
    ],
  },
  {
    feedClass: "CONCENTRATE",
    options: [
      sub("CONCENTRATE", "GRAIN"),
      sub("CONCENTRATE", "OILCAKE"),
      sub("CONCENTRATE", "BY_PRODUCT"),
      sub("CONCENTRATE", "COMPOUND_PELLET"),
      generic("CONCENTRATE"),
    ],
  },
  { feedClass: "MINERAL", options: [sub("MINERAL", "PREMIX"), generic("MINERAL")] },
  { feedClass: "VITAMIN", options: [generic("VITAMIN")] },
  { feedClass: "ADDITIVE", options: [sub("ADDITIVE", "SUPPLEMENT"), generic("ADDITIVE")] },
  { feedClass: "OTHER", options: [generic("OTHER")] },
];

const OPTION_BY_VALUE = new Map(FEED_CATEGORY_GROUPS.flatMap((g) => g.options).map((o) => [o.value, o]));

export function feedCategoryOption(value: string): FeedCategoryOption | undefined {
  return OPTION_BY_VALUE.get(value);
}

/** Display label for a stored item's category. `t` is scoped to `inventory.feed`. */
export function feedCategoryLabel(
  t: (key: string) => string,
  item: { feedClass: FeedClass; feedSubType: FeedSubType | null },
): string {
  const value = feedCategoryValue(item.feedClass, item.feedSubType);
  return value.startsWith("CLASS_") ? t(`categoryOptions.${value}`) : t(`subTypeOptions.${value}`);
}

/** The picker key for a stored `(feedClass, feedSubType)` pair. A missing or legacy `OTHER` subtype
 * falls back to the class-level entry, so every stored combination resolves to a selectable option. */
export function feedCategoryValue(feedClass: FeedClass | undefined, feedSubType?: FeedSubType | null): string {
  if (feedSubType && feedSubType !== "OTHER" && OPTION_BY_VALUE.has(feedSubType)) return feedSubType;
  return feedClass ? `CLASS_${feedClass}` : "";
}
