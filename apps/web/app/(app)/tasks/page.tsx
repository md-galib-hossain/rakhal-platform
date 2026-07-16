import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TasksView } from "@/features/tasks/components/tasks-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("taskHub")} — Rakhal`, robots: { index: false } };
}

/**
 * Task Hub (Figma 1039:48285 list page / 1039:48550 create modal / 1039:48730 details modal, file
 * `SCfMPdxP6vgW1uTxfqCtz7`) — real, cursor-backed `GET /tasks`. `TasksView` renders its own title +
 * "Create Task" action row (matching the mock's layout, unlike other pages that delegate that row to
 * `PageCard`), so this route doesn't wrap it in `PageCard` a second time.
 */
export default function TasksPage() {
  return <TasksView />;
}
