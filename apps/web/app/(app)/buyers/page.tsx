import { redirect } from "next/navigation";

/** Buyers is a tab of Sales since 2026-10-19 (`/sales?tab=buyers`); this route only keeps old
 * bookmarks and links alive. The per-buyer detail page (`/buyers/:id`) is unchanged. */
export default function BuyersPage() {
  redirect("/sales?tab=buyers");
}
