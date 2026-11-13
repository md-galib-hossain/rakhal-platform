"use client"; // live query + mutations

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Can } from "@/lib/auth/permissions";
import { Button } from "@rakhal/ui/ui/button";
import { Card } from "@rakhal/ui/ui/card";
import { Chip, type ChipProps } from "@rakhal/ui/ui/chip";
import { DateText } from "@/components/shared/date-text";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@rakhal/ui/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAnimalHolds, useCreateAnimalHold, useReleaseAnimalHold } from "../../hooks/use-cattle";
import type { AnimalHoldType } from "../../types";

const HOLD_TYPES: AnimalHoldType[] = ["REPRODUCTIVE", "MILK_DISCARD", "QUARANTINE", "OTHER"];

const HOLD_TYPE_VARIANT: Record<AnimalHoldType, NonNullable<ChipProps["variant"]>> = {
  REPRODUCTIVE: "warning",
  MILK_DISCARD: "destructive",
  QUARANTINE: "destructive",
  OTHER: "muted",
};

/** RAKHAL-280 gap closure — generic per-animal hold (`AnimalHoldController`, `cattle.hold`-gated).
 * Backend has shipped this since MILESTONE 10 but it had zero frontend surface. Placed on the
 * Health tab since QUARANTINE/MILK_DISCARD are health-adjacent concerns and REPRODUCTIVE holds
 * already surface separately as the `REPRODUCTIVE_HOLD` reproduction alert on the profile card —
 * this panel is the one place to see/manage the raw hold rows across all 4 types. */
export function AnimalHoldsPanel({ cattleId }: { cattleId: string }) {
  const t = useTranslations("cattle.detail.holds");
  const query = useAnimalHolds(cattleId);
  const createHold = useCreateAnimalHold();
  const releaseHold = useReleaseAnimalHold();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<AnimalHoldType>("QUARANTINE");
  const [reason, setReason] = useState("");

  async function handleCreate() {
    try {
      await createHold.mutateAsync({ cattleId, dto: { type, reason } });
      toast.success(t("createdToast"));
      setOpen(false);
      setReason("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  async function handleRelease(holdId: string) {
    try {
      await releaseHold.mutateAsync({ cattleId, holdId });
      toast.success(t("releasedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  const holds = query.data?.items ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("title")}</h3>
        <Can I="cattle.hold">
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            {t("place")}
          </Button>
        </Can>
      </div>

      {query.isLoading ? (
        <Skeleton className="h-14 w-full rounded-md" />
      ) : holds.length === 0 ? (
        <EmptyState title={t("emptyTitle")} className="py-6" />
      ) : (
        <div className="flex flex-col gap-2">
          {holds.map((hold) => (
            <Card key={hold.id} className="flex items-center justify-between gap-3 p-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Chip variant={HOLD_TYPE_VARIANT[hold.type]}>{t(`typeOptions.${hold.type}`)}</Chip>
                  <p className="text-sm text-foreground">{hold.reason}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  <DateText date={hold.startedAt} />
                  {hold.endedAt ? (
                    <>
                      {" — "}
                      {t("releasedOn")} <DateText date={hold.endedAt} />
                    </>
                  ) : null}
                </p>
              </div>
              {!hold.endedAt ? (
                <Can I="cattle.hold">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleRelease(hold.id)}
                    disabled={releaseHold.isPending}
                  >
                    {t("release")}
                  </Button>
                </Can>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t("place")}</SheetTitle>
            <SheetDescription>{t("placeDescription")}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t("type")}</Label>
              <Select value={type} onValueChange={(v) => setType(v as AnimalHoldType)}>
                <SelectTrigger aria-label={t("type")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOLD_TYPES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {t(`typeOptions.${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("reason")}</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <SheetFooter className="border-t border-dashed border-border pt-4">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={createHold.isPending}>
              {t("cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={createHold.isPending || reason.trim().length < 2}>
              {createHold.isPending ? "…" : t("confirm")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
