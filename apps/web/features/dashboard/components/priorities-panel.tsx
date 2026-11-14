"use client"; // live query + retry action + per-row expand state

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { TruncatedText } from "@rakhal/ui/shared/truncated-text";
import { useTranslations } from "next-intl";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { AnimalLink } from "@/components/shared/animal-link";
import { cn } from "@/lib/utils";
import { usePriorities } from "../hooks/use-dashboard-widgets";
import { DashboardCard } from "./dashboard-card";
import type { PriorityItem } from "../types";

/** Backend also sends a colored-dot `icon` emoji per item (🔴/🟠/🟡/🟢/⚪) — not rendered here.
 * Emoji glyphs vary in size/alignment across platforms and don't adapt to dark mode, so the dot
 * is drawn ourselves from `priority` using theme tokens instead. */
const PRIORITY_STYLE: Record<PriorityItem["priority"], { border: string; tint: string; dot: string }> = {
  critical: { border: "border-destructive/40", tint: "bg-destructive-tint/40", dot: "bg-destructive" },
  urgent: { border: "border-warning/40", tint: "bg-warning-tint/40", dot: "bg-warning" },
  important: { border: "border-warning/40", tint: "bg-card", dot: "bg-warning" },
  operational: { border: "border-success/40", tint: "bg-card", dot: "bg-success" },
  routine: { border: "border-border", tint: "bg-card", dot: "bg-border" },
};

/** A single priority row. When `item.cattle` has >1 entries (e.g. "5 cow(s) overdue for
 * treatment dose"), a chevron toggle expands a nested per-cow list — clicking a cow opens the
 * global `AnimalLink` detail modal in place (no page navigation away from the dashboard). The
 * row's own link/action stays clickable exactly as before either way. */
function PriorityRow({ item }: { item: PriorityItem }) {
  const t = useTranslations("dashboard.priorities");
  const [expanded, setExpanded] = useState(false);
  const cattle = item.cattle ?? [];
  const expandable = cattle.length > 1;
  const hiddenCount = item.truncated ? (item.count ?? cattle.length) - cattle.length : 0;
  const style = PRIORITY_STYLE[item.priority];

  return (
    <li>
      <div className="relative">
        <Link
          href={item.link}
          className={cn(
            "group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm shadow-xs transition-colors hover:bg-muted",
            expandable && "pr-10",
            style.border,
            style.tint,
          )}
        >
          <span className={cn("size-2 shrink-0 rounded-full", style.dot)} aria-hidden />
          <TruncatedText lines={2} className="flex-1 text-foreground">
            {item.message}
          </TruncatedText>
          <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-primary-hover transition-colors group-hover:border-primary-hover/40 group-hover:bg-success-tint">
            {item.actionLabel}
          </span>
        </Link>
        {expandable && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? t("collapse") : t("expand")}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="absolute inset-y-0 right-1.5 flex items-center rounded p-1.5 hover:bg-black/5"
          >
            <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden />
          </button>
        )}
      </div>
      {expandable && expanded && (
        <ul className="mt-1 ml-3.5 flex flex-col gap-0.5 border-l border-border pl-3">
          {cattle.map((c) => (
            <li key={c.id}>
              <AnimalLink
                id={c.id}
                animalName={c.name}
                tagNumber={c.tag}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs font-normal text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <span className="truncate">{c.name ?? c.tag}</span>
                {c.name && <span className="text-muted-foreground/70">#{c.tag}</span>}
              </AnimalLink>
            </li>
          ))}
          {item.truncated && (
            <li className="px-2 py-1 text-xs text-muted-foreground">{t("moreNotShown", { count: hiddenCount })}</li>
          )}
        </ul>
      )}
    </li>
  );
}

export function PrioritiesPanel() {
  const t = useTranslations("dashboard.priorities");
  const query = usePriorities();

  if (query.isLoading) return <CardSkeleton lines={4} className="h-full min-h-[360px] rounded-2xl" />;
  if (query.isError) {
    return (
      <DashboardCard title={t("title")} className="min-h-[360px]">
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </DashboardCard>
    );
  }

  const priorities = query.data?.priorities ?? [];
  const attentionCount = priorities.filter((p) => p.priority === "critical" || p.priority === "urgent").length;

  return (
    <DashboardCard
      title={t("title")}
      className="min-h-[360px]"
      headerRight={
        attentionCount > 0 ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-destructive-tint px-2.5 py-1 text-xs font-semibold text-destructive">
            {t("attentionCount", { count: attentionCount })}
          </span>
        ) : undefined
      }
    >
      {priorities.length === 0 ? (
        <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <ul className="flex flex-1 flex-col gap-1.5">
          {priorities.map((item, index) => (
            <PriorityRow key={index} item={item} />
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
