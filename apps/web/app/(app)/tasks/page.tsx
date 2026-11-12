import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TasksView } from "@/features/tasks/components/tasks-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("taskHub")} — Rakhal`, robots: { index: false } };
}

/**
 * Task Hub (Figma 1039:48285 list page / 1039:48550 create modal / 1039:48730 details modal, file
 * `SCfMPdxP6vgW1uTxfqCtz7`) — real, cursor-backed `GET /tasks`. `TasksView` wraps itself in the shared `PageCard`.
 * Reminders are not tasks any more (Notifications v2), so the old `?view=reminders` / `?segment=reminders` bookmarks
 * simply land on the plain task list.
 */
export default function TasksPage() {
  return <TasksView />;
}
