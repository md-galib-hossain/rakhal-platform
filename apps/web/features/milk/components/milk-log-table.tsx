"use client"; // drafts across all sessions + save/submit mutations + client-side search/shed filter + pagination

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { TrendingDown, TrendingUp } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { Can } from "@/lib/auth/permissions";
import { useSaveMilkLog, useSubmitMilk } from "../hooks/use-milk";
import type { MilkLogRow, MilkSession } from "../types";

const SESSION_FIELD: Record<MilkSession, "morningL" | "noonL" | "eveningL" | "nightL"> = {
  MORNING: "morningL",
  NOON: "noonL",
  EVENING: "eveningL",
  NIGHT: "nightL",
};

const SESSION_COLUMN_LABEL: Record<MilkSession, string> = {
  MORNING: "morningLog",
  NOON: "noonLog",
  EVENING: "eveningLog",
  NIGHT: "nightLog",
};

const PAGE_SIZE = 8;

function draftKey(cattleId: string, session: MilkSession): string {
  return `${cattleId}:${session}`;
}

function buildInitialDrafts(rows: MilkLogRow[], sessions: MilkSession[]): Record<string, string> {
  const drafts: Record<string, string> = {};
  for (const row of rows) {
    for (const session of sessions) {
      const value = row.log[SESSION_FIELD[session]];
      drafts[draftKey(row.cattleId, session)] = value == null ? "" : String(value);
    }
  }
  return drafts;
}

/** The editable grid for one day — all of the farm's configured sessions as columns at once (Figma
 * "Milk Log" table, node 734:32499), parented by `MilkLogSection` which remounts this (via
 * `key={date}`) on every date change so `useState`'s initializer always seeds fresh from that day's
 * saved values, with no `useEffect` resync needed. Search/shed filtering only affects which rows are
 * *displayed* — Save/Submit always act on the full day's rows (`entries`), not just the current
 * filtered/paginated page, since "Submit All Logs" means the whole day, not the current view. */
export function MilkLogTable({
  date,
  sessions,
  entries,
  search,
  shed,
}: {
  date: string;
  sessions: MilkSession[];
  entries: MilkLogRow[];
  search: string;
  shed: string | null;
}) {
  const t = useTranslations("milk.log");
  const saveLog = useSaveMilkLog();
  const submitMilk = useSubmitMilk();
  const [drafts, setDrafts] = useState<Record<string, string>>(() => buildInitialDrafts(entries, sessions));
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((row) => {
      if (shed && row.shed !== shed) return false;
      if (!q) return true;
      return row.tag.toLowerCase().includes(q) || (row.name ?? "").toLowerCase().includes(q);
    });
  }, [entries, search, shed]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleSave() {
    let saved = 0;
    let anomaliesFlagged = 0;
    try {
      for (const session of sessions) {
        const sessionEntries = entries
          .map((row) => ({ cattleId: row.cattleId, yieldL: Number(drafts[draftKey(row.cattleId, session)]) }))
          .filter((entry) => {
            const raw = drafts[draftKey(entry.cattleId, session)];
            return raw !== "" && Number.isFinite(entry.yieldL) && entry.yieldL >= 0;
          });
        if (sessionEntries.length === 0) continue;
        const result = await saveLog.mutateAsync({ date, session, entries: sessionEntries });
        saved += result.saved;
        anomaliesFlagged += result.anomaliesFlagged;
      }
      if (saved === 0) {
        toast.error(t("noEntries"));
        return;
      }
      toast.success(t("savedToast", { saved, anomalies: anomaliesFlagged }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("saveError"));
    }
  }

  async function handleSubmit() {
    try {
      let totalCowsLogged = 0;
      for (const session of sessions) {
        const result = await submitMilk.mutateAsync({ date, session });
        totalCowsLogged += result.totalCowsLogged;
      }
      toast.success(t("submittedToast", { count: totalCowsLogged }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("submitError"));
    }
  }

  const isPending = saveLog.isPending || submitMilk.isPending;

  return (
    <>
      {filtered.length === 0 ? (
        <EmptyState title={entries.length === 0 ? t("noCattle") : t("noSearchResults")} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.cowId")}</TableHead>
                <TableHead>{t("columns.name")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead>{t("columns.shed")}</TableHead>
                {sessions.map((session) => (
                  <TableHead key={session}>{t(`columns.${SESSION_COLUMN_LABEL[session]}`)}</TableHead>
                ))}
                <TableHead>{t("columns.tank")}</TableHead>
                <TableHead>{t("columns.total")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((row) => (
                <TableRow key={row.cattleId}>
                  <TableCell className="font-medium text-foreground">{row.tag}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="size-8">
                        <AvatarFallback>{(row.name ?? row.tag).slice(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">{row.name ?? row.tag}</span>
                        <span className="text-xs text-muted-foreground">
                          {row.avgYield7d != null ? t("avgYieldCaption", { value: row.avgYield7d }) : "—"}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip variant="primary">{t("statusMilking")}</Chip>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.shed ?? "—"}</TableCell>
                  {sessions.map((session) => (
                    <TableCell key={session}>
                      <Can I="milk.log">
                        <div className="flex h-9 w-24 items-center gap-1 rounded-lg border border-border bg-card px-2 shadow-xs">
                          <Input
                            type="number"
                            min={0}
                            step={0.1}
                            className="h-auto w-full border-none p-0 shadow-none focus-visible:ring-0"
                            value={drafts[draftKey(row.cattleId, session)] ?? ""}
                            onChange={(e) =>
                              setDrafts((prev) => ({ ...prev, [draftKey(row.cattleId, session)]: e.target.value }))
                            }
                          />
                          <span className="shrink-0 text-xs text-muted-foreground">L</span>
                        </div>
                      </Can>
                    </TableCell>
                  ))}
                  <TableCell>
                    {row.withholding ? (
                      <Badge variant="warning">{t("tankWithholding")}</Badge>
                    ) : (
                      <Badge variant="success">{t("tankSellable")}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">{row.log.totalL}L</span>
                      {row.avgYield7d != null ? (
                        row.log.totalL >= row.avgYield7d ? (
                          <TrendingUp className="size-3.5 text-success" aria-hidden />
                        ) : (
                          <TrendingDown className="size-3.5 text-destructive" aria-hidden />
                        )
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={setPage} /> : null}
        </>
      )}
      <Can I="milk.log">
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" disabled={isPending} onClick={handleSave}>
            {saveLog.isPending ? t("saving") : t("save")}
          </Button>
          <Button disabled={isPending} onClick={handleSubmit}>
            {submitMilk.isPending ? t("submitting") : t("submit")}
          </Button>
        </div>
      </Can>
    </>
  );
}
