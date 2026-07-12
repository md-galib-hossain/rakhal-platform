import { cn } from "@/lib/utils";
import type { MedicineStockStatus } from "../types";

const COLOR: Record<MedicineStockStatus, string> = {
  adequate: "text-success",
  low: "text-warning",
  out: "text-destructive",
};

/** Small decorative stock-level arc (Figma's "Stock" column glyph) — colored by the real
 * `stockStatus` the backend derives (`domain/medicine-status.ts#computeStockStatus`), not a
 * fabricated percentage-fill (the backend doesn't expose a "max stock" to compute one against). */
export function StockStatusIcon({ status, className }: { status: MedicineStockStatus; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-5", COLOR[status], className)}
      aria-hidden
    >
      <path
        d="M4 15a8 8 0 1 1 16 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
