"use client"; // action button callback + bull-name lookup

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cattleApi } from "@/features/cattle/api";
import { AnimalLink } from "@/components/shared/animal-link";
import type { SemenBatch, SemenTank } from "../types";
import { STRAW_COLOR_SWATCHES } from "./semen-batch-form-dialog";
import { TruncatedText } from "@/components/shared/truncated-text";

/** `bullId` now stores a `Cattle.id` (picked via `CattlePicker`), not a free-text bull name/tag —
 * resolve it to a tag/name for display instead of showing the raw cuid. */
function useBullLabel(bullId: string | null) {
  const { data } = useQuery({
    queryKey: ["semen-batch-bull", bullId],
    queryFn: () => cattleApi.findOne(bullId as string),
    enabled: Boolean(bullId),
    staleTime: 30_000,
  });
  if (!bullId) return "—";
  if (!data) return "…";
  return data.name ? `${data.tagNumber} — ${data.name}` : data.tagNumber;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col gap-3 rounded-xl bg-muted p-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-bold text-foreground">{value}</span>
    </div>
  );
}

/**
 * "Active Straw Batch Card" — Figma "Inventory - Semen" 732:20158 (node 465:8830): name + batch-code
 * chip, Bull ID/Breed/Straw Color rows, Tank/Canister/Cane/Goblet tiles, a big "Straw Left" count.
 * The count turns `destructive` when `batch.lowStraw` (`strawQuantity <= lowStrawThreshold`) instead
 * of always `primary` — the mock shows one card in rose/red without the underlying rule spelled out,
 * so this wires it to the real derived flag rather than guessing a fixed color per card.
 */
export function SemenBatchCard({
  batch,
  tank,
  onEdit,
  onArchive,
}: {
  batch: SemenBatch;
  tank: SemenTank | undefined;
  onEdit: (batch: SemenBatch) => void;
  onArchive: (batch: SemenBatch) => void;
}) {
  const t = useTranslations("inventory.semen.batchCard");
  const swatch = STRAW_COLOR_SWATCHES.find((s) => s.value.toLowerCase() === (batch.strawColor ?? "").toLowerCase());
  const bullLabel = useBullLabel(batch.bullId);

  return (
    <div className="flex flex-1 flex-col gap-6 rounded-2xl bg-card p-4 shadow-[0px_0px_3px_rgba(0,0,0,0.1)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 flex-col justify-center gap-3">
          <TruncatedText className="text-xl font-bold text-foreground">{batch.name}</TruncatedText>
          {batch.batchCode ? <Chip variant="muted">{batch.batchCode}</Chip> : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={t("menu")} className="flex size-5 items-center justify-center text-muted-foreground transition-colors hover:text-foreground">
              <MoreHorizontal className="size-5" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onEdit(batch)}>{t("edit")}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onArchive(batch)} className="text-destructive">
              {t("archive")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("bullId")}</span>
          {batch.bullId ? (
            <AnimalLink id={batch.bullId} className="font-medium text-foreground hover:text-primary">
              {bullLabel}
            </AnimalLink>
          ) : (
            <span className="font-medium text-foreground">{bullLabel}</span>
          )}
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("breed")}</span>
          <span className="font-medium text-foreground">{batch.breed || "—"}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("strawColor")}</span>
          <span className="flex items-center gap-1 font-medium text-foreground">
            {batch.strawColor ? (
              <>
                <span className={cn("size-3 rounded-sm", swatch?.className ?? "bg-muted-foreground")} />
                {batch.strawColor}
              </>
            ) : (
              "—"
            )}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("semenType")}</span>
          <span className="font-medium text-foreground">
            {batch.semenType ? t(`semenTypeValue.${batch.semenType}`) : "—"}
            {batch.semenType === "SEX_SORTED" && batch.targetSex
              ? ` (${t(`targetSexValue.${batch.targetSex}`)})`
              : ""}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <InfoTile label={t("tank")} value={tank?.name ?? "—"} />
          <InfoTile label={t("canister")} value={batch.canister || "—"} />
        </div>
        <div className="flex items-center gap-3">
          <InfoTile label={t("goblet")} value={batch.goblet || "—"} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-card p-2 shadow-[0px_0px_3px_rgba(0,0,0,0.1)]">
        <span className="flex items-center gap-1 text-base font-medium text-muted-foreground">{t("strawLeft")}</span>
        <span className={cn("text-right text-2xl font-bold", batch.lowStraw ? "text-destructive" : "text-primary")}>{batch.strawQuantity}</span>
      </div>
    </div>
  );
}
