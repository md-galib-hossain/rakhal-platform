import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { TasksView } from "@/features/tasks/components/tasks-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("taskHub")} — Rakhal`, robots: { index: false } };
}

/**
 * Task Hub (Figma 1039:48285 list page / 1039:48550 create modal / 1039:48730 details modal, file
 * `SCfMPdxP6vgW1uTxfqCtz7`) — real, cursor-backed `GET /tasks`. `TasksView` wraps itself in the shared `PageCard` (title + action depend on the active segment, which is client state), so this route does not wrap it again.
 */
export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Old bookmarks used `?view=reminders`, but `?view=` belongs to the animal workspace overlay (it opened with a bogus
  // animal id). The literal value "reminders" is never an animal id, so rewrite it to the segment param, keeping the rest.
  const sp = await searchParams;
  if (sp.view === "reminders") {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (k !== "view" && typeof v === "string") next.set(k, v);
    if (!next.has("segment")) next.set("segment", "reminders");
    redirect(`/tasks?${next.toString()}`);
  }
  // `useSearchParams` (the `?segment=` param) needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <TasksView />
    </Suspense>
  );
}
