import { redirect } from "next/navigation";

/**
 * RFE-023 — there is no standalone cattle detail page anymore (per user decision): the "Cattle
 * Details" right-side drawer (`CattleDetailSheet`, opened from the list's row-actions menu) is the
 * single detail view. This route only exists so old/bookmarked `/animals/:id` (formerly
 * `/cattle/:id`) links keep working — it immediately redirects into the list with the drawer's
 * URL-synced `view` param (`CattleTable`'s `useQueryState("view", ...)`), which opens the same sheet.
 */
export default async function CattleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/animals?view=${id}`);
}
