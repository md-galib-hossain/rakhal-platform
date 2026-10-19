import { redirect } from "next/navigation";

/** Suppliers is a tab of Purchasing since 2026-10-19 (`/purchasing?tab=suppliers`); this route only
 * keeps old bookmarks and links alive. */
export default function SuppliersPage() {
  redirect("/purchasing?tab=suppliers");
}
