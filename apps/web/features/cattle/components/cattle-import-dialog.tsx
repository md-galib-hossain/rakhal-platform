"use client"; // multi-step wizard state + 2 mutations

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { useImportCattleConfirm, useImportCattlePreview } from "../hooks/use-cattle";
import type { CattleImportPreview } from "../types";

/**
 * RFE-024 — Cattle Excel import (PRD §8.4, RAKHAL-043). Two real backend steps: `POST
 * /cattle/import/preview` (multipart .xlsx, per-row validation cached 30 min under
 * `importSessionId`) then `POST /cattle/import/confirm` (imports the `ready` rows; `skipErrors`
 * required if any row failed validation). No column-mapping UI in this pass — the backend's
 * canonical headers (name/tag/gender/purpose/date_of_birth/breed/shed/color/notes, matched
 * case-insensitively) are documented in the dialog description instead of building a mapping
 * picker, since `mapping` is optional and a first cut should just work against a
 * canonically-headed sheet.
 */
export function CattleImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("cattle.import");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CattleImportPreview | null>(null);
  const [skipErrors, setSkipErrors] = useState(false);
  const previewMutation = useImportCattlePreview();
  const confirmMutation = useImportCattleConfirm();

  function reset() {
    setFile(null);
    setPreview(null);
    setSkipErrors(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handlePreview() {
    if (!file) return;
    try {
      const result = await previewMutation.mutateAsync(file);
      setPreview(result);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    try {
      const result = await confirmMutation.mutateAsync({
        importSessionId: preview.importSessionId,
        skipErrors,
      });
      toast.success(t("confirmedToast", { imported: result.imported, skipped: result.skipped }));
      handleOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  const hasErrors = (preview?.errors ?? 0) > 0;
  const canConfirm = Boolean(preview) && (!hasErrors || skipErrors);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div className="flex flex-col gap-3">
            <Label htmlFor="cattle-import-file">{t("chooseFile")}</Label>
            <input
              id="cattle-import-file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{t("summary.total", { count: preview.total })}</Badge>
              <Badge variant="success">{t("summary.ready", { count: preview.ready })}</Badge>
              {hasErrors ? (
                <Badge variant="destructive">{t("summary.errors", { count: preview.errors })}</Badge>
              ) : null}
            </div>

            <div className="max-h-72 overflow-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.row")}</TableHead>
                    <TableHead>{t("columns.tag")}</TableHead>
                    <TableHead>{t("columns.name")}</TableHead>
                    <TableHead>{t("columns.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((r) => (
                    <TableRow key={r.row}>
                      <TableCell>{r.row}</TableCell>
                      <TableCell>{r.tag ?? "—"}</TableCell>
                      <TableCell>{r.name ?? "—"}</TableCell>
                      <TableCell>
                        {r.status === "ready" ? (
                          <Badge variant="success">{t("columns.readyBadge")}</Badge>
                        ) : (
                          <Badge variant="destructive" title={r.error}>
                            {r.error ?? t("columns.errorBadge")}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {hasErrors ? (
              <label className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox checked={skipErrors} onCheckedChange={(v) => setSkipErrors(v === true)} />
                {t("skipErrors")}
              </label>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t("cancel")}
          </Button>
          {!preview ? (
            <Button onClick={handlePreview} disabled={!file || previewMutation.isPending}>
              {previewMutation.isPending ? "…" : t("previewAction")}
            </Button>
          ) : (
            <Button onClick={handleConfirm} disabled={!canConfirm || confirmMutation.isPending}>
              {confirmMutation.isPending ? "…" : t("confirmAction")}
            </Button>
          )}
        </DialogFooter>

        {preview && preview.rows.length === 0 ? (
          <EmptyState title={t("empty")} className="py-8" />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
