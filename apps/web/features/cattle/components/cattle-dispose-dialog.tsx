"use client"; // type/date/reason fields + mutation

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
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDisposeCattle } from "../hooks/use-cattle";
import type { CattleDisposeInput } from "../schemas";
import type { CattleListItem } from "../types";

type DisposeType = "SALE" | CattleDisposeInput["type"];
const TYPES: DisposeType[] = ["SALE", "CULL", "DEATH"];

/**
 * `POST /cattle/:id/dispose` (RAKHAL-399/402) — Cull/Death only; picking "Sold" here doesn't post
 * to that route at all. Selling is a real financial event (price + payment + ledger posting) that
 * belongs to the existing `SellAnimalUseCase`/`RecordSaleDialog` (`features/sales`) — this dialog
 * never duplicates those fields. Instead, choosing Sold hands off via `onRequestSale` (the parent
 * closes this dialog and opens `RecordSaleDialog` pre-scoped to the animal). Cull/Death dispositions
 * always close an active lactation server-side.
 */
export function CattleDisposeDialog({
  open,
  onOpenChange,
  cattle,
  onRequestSale,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cattle: CattleListItem | null;
  onRequestSale: (cattle: CattleListItem) => void;
}) {
  const t = useTranslations("cattle.disposeDialog");
  const dispose = useDisposeCattle();
  const [type, setType] = useState<DisposeType>("SALE");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");

  if (!cattle) return null;

  async function handleConfirm() {
    if (!cattle) return;
    if (type === "SALE") {
      onRequestSale(cattle);
      onOpenChange(false);
      return;
    }
    try {
      await dispose.mutateAsync({ id: cattle.id, dto: { type, date, reason: reason.trim() || undefined } });
      toast.success(t("disposedToast"));
      onOpenChange(false);
      setReason("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title", { name: cattle.name ?? cattle.tagNumber })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label>{t("type")}</Label>
          <Select value={type} onValueChange={(v) => setType(v as DisposeType)}>
            <SelectTrigger aria-label={t("type")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((v) => (
                <SelectItem key={v} value={v}>
                  {t(`typeOptions.${v}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {type === "SALE" ? (
          <p className="text-sm text-muted-foreground">{t("saleHandoffNote")}</p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dispose-date">{t("date")}</Label>
              <Input id="dispose-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dispose-reason">{t("reason")}</Label>
              <Textarea
                id="dispose-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("reasonPlaceholder")}
                rows={3}
              />
            </div>
            {cattle.productionStatus === "MILKING" ? (
              <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning-tint px-3 py-2 text-sm text-warning">
                <AlertTriangle className="size-4 shrink-0" aria-hidden />
                <p>{t("closesLactationWarning")}</p>
              </div>
            ) : null}
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={dispose.isPending}>
            {t("cancel")}
          </Button>
          <Button
            variant={type === "SALE" ? "primary" : "destructive"}
            onClick={handleConfirm}
            disabled={dispose.isPending || (type !== "SALE" && !date)}
          >
            {dispose.isPending ? "…" : type === "SALE" ? t("continue") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
