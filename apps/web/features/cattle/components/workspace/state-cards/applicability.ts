import type { CattleDetail } from "../../../types";

export type CardKey = "reproduction" | "milk" | "health" | "growth";

/**
 * Which state cards an animal gets (03 §3.2: "cards that do not apply are not rendered"). Health and Growth apply
 * to everyone; Reproduction to heifers and cows only (no card for calves, bulls and steers); Milk to cows and any
 * animal that already has a production state. The bull "Sire" card needs a backend summary and is not in Wave 0.
 */
export function applicableCards(cattle: Pick<CattleDetail, "gender" | "animalCategory" | "productionStatus">): CardKey[] {
  const female = cattle.gender === "FEMALE";
  const cards: CardKey[] = [];
  if (female && (cattle.animalCategory === "HEIFER" || cattle.animalCategory === "COW")) cards.push("reproduction");
  if (female && (cattle.animalCategory === "COW" || cattle.productionStatus != null)) cards.push("milk");
  cards.push("health", "growth");
  return cards;
}
