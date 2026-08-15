"use client"; // live query + retry action + per-row expand state

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { usePriorities } from "../hooks/use-dashboard-widgets";
import { DashboardCard } from "./dashboard-card";
import type { PriorityItem } from "../types";

const PRIORITY_STYLE: Record<PriorityItem["priority"], string> = {
  critical: "border-l-destructive",
  urgent: "border-l-warning",
  important: "border-l-warning",
  operational: "border-l-success",
  routine: "border-l-border",
};

/** A single priority row. When `item.cattle` has >1 entries (e.g. "5 cow(s) overdue for
 * treatment dose"), a chevron toggle expands a nested per-cow list — clicking a cow links to
 * its detail drawer (`/animals?view=<id>`, the only existing per-cow deep link). The row's own
 * link/action stays clickable exactly as before either way. */
function PriorityRow({ item }: { item: PriorityItem }) {
  const t = useTranslations("dashboard.priorities");
  const [expanded, setExpanded] = useState(false);
  const cattle = item.cattle ?? [];
  const expandable = cattle.length > 1;
  const hiddenCount = item.truncated ? (item.count ?? cattle.length) - cattle.length : 0;

  return (
    <li>
      <div className="relative">
        <Link
          href={item.link}
          className={cn(
            "flex items-center justify-between gap-3 rounded-md border-l-4 bg-muted/50 px-3 py-2.5 text-sm transition-colors hover:bg-muted",
            expandable && "pr-9",
            PRIORITY_STYLE[item.priority],
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden>{item.icon}</span>
            <span className="truncate text-foreground">{item.message}</span>
          </span>
          <span className="shrink-0 text-xs font-medium text-primary-hover">{item.actionLabel}</span>
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
            className="absolute inset-y-0 right-2 flex items-center rounded p-1 hover:bg-muted"
          >
            <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden />
          </button>
        )}
      </div>
      {expandable && expanded && (
        <ul className="mt-1 flex flex-col gap-0.5 pl-6">
          {cattle.map((c) => (
            <li key={c.id}>
              <Link
                href={`/animals?view=${c.id}`}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <span className="truncate">{c.name ?? c.tag}</span>
                {c.name && <span className="text-muted-foreground/70">#{c.tag}</span>}
              </Link>
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

  if (query.isLoading) return <CardSkeleton lines={4} className="rounded-2xl" />;
  if (query.isError) {
    return (
      <DashboardCard title={t("title")}>
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </DashboardCard>
    );
  }

  const priorities = query.data?.priorities ?? [];

  return (
    <DashboardCard title={t("title")}>
      {priorities.length === 0 ? (
        <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <ul className="flex flex-1 flex-col gap-2">
          {priorities.map((item, index) => (
            <PriorityRow key={index} item={item} />
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
