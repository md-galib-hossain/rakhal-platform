"use client"; // session tabs + query orchestration; editable state lives in MilkSessionTable

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Table, TableBody } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { useMilkLogTable } from "../hooks/use-milk";
import type { MilkSession } from "../types";
import { MilkCard } from "./milk-card";
import { MilkSessionTable } from "./milk-session-table";

const SESSION_LABEL: Record<MilkSession, string> = {
  MORNING: "morning",
  NOON: "noon",
  EVENING: "evening",
  NIGHT: "night",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Session tabs (only the farm's `milkActiveSessions`, per `sessionConfig`) wrapping
 * `MilkSessionTable` — the actual editable grid + save/submit, in its own component so it can be
 * `key`-remounted per session switch (fresh `useState` initializer from the freshly-selected
 * session's data, no `useEffect` re-seed — React Compiler's `set-state-in-effect` rule flags
 * synchronous `setState` in an effect as a cascading-render anti-pattern; same remount-key fix
 * `CattleFormDialogBody` already established in this codebase for an equivalent reset-on-change
 * need). Backed by the real `GET /milk/log` (all 4 sessions' already-saved values for the day). */
export function MilkSessionLog() {
  const t = useTranslations("milk.log");
  const date = todayIso();
  const query = useMilkLogTable(date);

  const sessions = query.data?.sessionConfig ?? [];
  const [session, setSession] = useState<MilkSession | null>(null);
  const activeSession = session ?? sessions[0] ?? null;

  if (query.isLoading) {
    return (
      <MilkCard title={t("title")} className="lg:col-span-3">
        <Table>
          <TableBody>
            <TableSkeleton rows={5} columns={5} />
          </TableBody>
        </Table>
      </MilkCard>
    );
  }
  if (query.isError) {
    return (
      <MilkCard title={t("title")} className="lg:col-span-3">
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </MilkCard>
    );
  }
  if (sessions.length === 0 || !activeSession) {
    return (
      <MilkCard title={t("title")} className="lg:col-span-3">
        <EmptyState title={t("noSessionsConfigured")} />
      </MilkCard>
    );
  }

  const headerRight = (
    <div className="flex flex-wrap gap-1.5">
      {sessions.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => setSession(s)}
          className={
            "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors " +
            (s === activeSession
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-card text-muted-foreground hover:bg-muted")
          }
        >
          {t(`session.${SESSION_LABEL[s]}`)}
        </button>
      ))}
    </div>
  );

  return (
    <MilkCard title={t("title")} headerRight={headerRight} className="lg:col-span-3">
      <MilkSessionTable key={activeSession} date={date} session={activeSession} rows={query.data?.entries ?? []} />
    </MilkCard>
  );
}
