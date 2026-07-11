"use client"; // per-row editable inputs + save/submit mutations

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { Can } from "@/lib/auth/permissions";
import { useSaveMilkLog, useSubmitMilk } from "../hooks/use-milk";
import type { MilkLogRow, MilkSession } from "../types";

const SESSION_FIELD: Record<MilkSession, "morningL" | "noonL" | "eveningL" | "nightL"> = {
  MORNING: "morningL",
  NOON: "noonL",
  EVENING: "eveningL",
  NIGHT: "nightL",
};

function buildInitialDrafts(rows: MilkLogRow[], field: keyof MilkLogRow["log"]): Record<string, string> {
  const drafts: Record<string, string> = {};
  for (const row of rows) {
    const value = row.log[field];
    drafts[row.cattleId] = value == null ? "" : String(value);
  }
  return drafts;
}

/** The editable grid for one session — parented by `MilkSessionLog`, which remounts this (via
 * `key={session}`) on every session switch so `useState`'s initializer always seeds fresh from
 * that session's own saved values, with no `useEffect` resync needed. */
export function MilkSessionTable({ date, session, rows }: { date: string; session: MilkSession; rows: MilkLogRow[] }) {
  const t = useTranslations("milk.log");
  const saveLog = useSaveMilkLog();
  const submitMilk = useSubmitMilk();
  const field = SESSION_FIELD[session];
  const [drafts, setDrafts] = useState<Record<string, string>>(() => buildInitialDrafts(rows, field));

  async function handleSave() {
    const entries = rows
      .map((row) => ({ cattleId: row.cattleId, yieldL: Number(drafts[row.cattleId]) }))
      .filter((entry) => Number.isFinite(entry.yieldL) && entry.yieldL >= 0 && drafts[entry.cattleId] !== "");
    if (entries.length === 0) {
      toast.error(t("noEntries"));
      return;
    }
    try {
      const result = await saveLog.mutateAsync({ date, session, entries });
      toast.success(t("savedToast", { saved: result.saved, anomalies: result.anomaliesFlagged }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("saveError"));
    }
  }

  async function handleSubmit() {
    try {
      const result = await submitMilk.mutateAsync({ date, session });
      toast.success(t("submittedToast", { count: result.totalCowsLogged }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("submitError"));
    }
  }

  return (
    <>
      {rows.length === 0 ? (
        <EmptyState title={t("noCattle")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.cattle")}</TableHead>
              <TableHead>{t("columns.shed")}</TableHead>
              <TableHead>{t("columns.avg7d")}</TableHead>
              <TableHead>{t("columns.yield")}</TableHead>
              <TableHead>{t("columns.tank")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.cattleId}>
                <TableCell>
                  <span className="font-medium text-foreground">{row.name ?? row.tag}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">{row.tag}</span>
                </TableCell>
                <TableCell className="text-muted-foreground">{row.shed ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{row.avgYield7d ?? "—"}</TableCell>
                <TableCell>
                  <Can I="milk.log">
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      className="h-9 w-24"
                      value={drafts[row.cattleId] ?? ""}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [row.cattleId]: e.target.value }))}
                    />
                  </Can>
                </TableCell>
                <TableCell>
                  {row.withholding ? (
                    <Badge variant="warning">{t("tankWithholding")}</Badge>
                  ) : (
                    <Badge variant="success">{t("tankSellable")}</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Can I="milk.log">
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" disabled={saveLog.isPending} onClick={handleSave}>
            {saveLog.isPending ? t("saving") : t("save")}
          </Button>
          <Button disabled={submitMilk.isPending} onClick={handleSubmit}>
            {submitMilk.isPending ? t("submitting") : t("submit")}
          </Button>
        </div>
      </Can>
    </>
  );
}
