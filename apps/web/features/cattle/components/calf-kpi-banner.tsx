"use client"; // reads the animalCategory URL param the category tiles/filter drive

import { useSearchParams } from "next/navigation";
import { CalvesKpiCards } from "@/features/calves/components/calves-kpi-cards";

/** Shows the Calves module's own KPI row (fed today / health concern / weaning due) only while the
 * Animal page's category filter is narrowed to CALF — calves are just `animalCategory: "CALF"`
 * cattle rows now (the standalone `/calves` page is gone), so this is the one place calf-specific
 * context still surfaces on the merged page. Reuses `CalvesKpiCards` as-is (composition, not a
 * rewrite) — same `GET /calves` KPI query it always used. */
export function CalfKpiBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("animalCategory") !== "CALF") return null;
  return <CalvesKpiCards />;
}
