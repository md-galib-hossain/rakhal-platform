"use client"; // popover state + live milk-eligibility query

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RowActionsMenu, type RowAction } from "@/components/shared/row-actions-menu";
import { useMilkEligibility } from "@/features/milk/hooks/use-milk";
import { avatarTint } from "../../avatar-tint";
import { ANIMAL_CATEGORY_VARIANT } from "../../utils/animal-category-style";
import type { CattleDetail } from "../../types";

type ChipVariant = React.ComponentProps<typeof Chip>["variant"];
interface HeaderChip {
  key: string;
  label: string;
  variant: ChipVariant;
}

const MAX_VISIBLE_CHIPS = 5;

function ageParts(dob: string | null): { years: number; months: number } | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years: Math.max(years, 0), months };
}

/**
 * Animal Workspace header (RFE-154, 03 §3.2): photo, name + tag (tag shown once when there is no name), a derived
 * subtitle, state chips (max 5 then a `+N` popover — informative, never buttons), the one filled "Record event"
 * button, a secondary Edit, and `⋯` for Dispose / Delete / Restore.
 */
export function WorkspaceHeader({
  cattle,
  titleRef,
  actions,
  canEdit,
  canRecord,
  onRecord,
  onEdit,
  onClose,
}: {
  cattle: CattleDetail;
  titleRef: React.RefObject<HTMLHeadingElement | null>;
  actions: RowAction[];
  canEdit: boolean;
  canRecord: boolean;
  onRecord: () => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("events.workspace");
  const tc = useTranslations("cattle.detail");
  const eligibility = useMilkEligibility(cattle.gender === "FEMALE" ? cattle.id : undefined).data;

  const chips = useMemo<HeaderChip[]>(() => {
    const list: HeaderChip[] = [
      { key: "category", label: tc(`animalCategoryOptions.${cattle.animalCategory}`), variant: ANIMAL_CATEGORY_VARIANT[cattle.animalCategory] },
    ];
    if (cattle.productionStatus) {
      const status = tc(`statusOptions.${cattle.productionStatus.toLowerCase()}`);
      list.push({
        key: "production",
        label: cattle.dim != null ? `${status} · ${t("dim", { days: cattle.dim })}` : status,
        variant: cattle.productionStatus === "MILKING" ? "primary" : "warning",
      });
    }
    if (cattle.gender === "FEMALE" && cattle.reproductiveStatus === "PREGNANT") {
      list.push({ key: "pregnant", label: t("pregnant"), variant: "info" });
    }
    if (eligibility && (eligibility.primaryStatus === "WITHHELD" || eligibility.primaryStatus === "DISCARD_REQUIRED")) {
      list.push({ key: "hold", label: t("milkHold"), variant: "destructive" });
    }
    if (cattle.lactationStage) {
      list.push({ key: "lactation", label: tc(`lactationStageOptions.${cattle.lactationStage}`), variant: "muted" });
    }
    return list;
  }, [cattle, eligibility, t, tc]);

  const age = ageParts(cattle.dateOfBirth);
  const subtitle = [
    cattle.breed?.name,
    age ? t("ageValue", age) : null,
    cattle.shed?.name,
  ]
    .filter(Boolean)
    .join(" · ");
  const visible = chips.slice(0, MAX_VISIBLE_CHIPS);
  const hidden = chips.slice(MAX_VISIBLE_CHIPS);
  const hasName = Boolean(cattle.name);

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("back")}
          className="-ml-1 mt-1 flex size-10 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-muted sm:hidden"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <Avatar className="size-12 shrink-0 rounded-lg sm:size-16">
          {cattle.profile_photo ? <AvatarImage src={cattle.profile_photo.thumb_url} alt="" /> : null}
          <AvatarFallback className={cn("rounded-lg text-lg", avatarTint(cattle.id))}>
            {(cattle.name ?? cattle.tagNumber).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 ref={titleRef} tabIndex={-1} className="truncate text-xl font-bold text-foreground outline-none">
            {hasName ? cattle.name : cattle.tagNumber}
            {hasName ? <span className="ml-2 text-sm font-normal text-muted-foreground">{cattle.tagNumber}</span> : null}
          </h2>
          {subtitle ? <p className="truncate text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canRecord ? (
            <Button type="button" className="hidden h-10 gap-1.5 sm:inline-flex" onClick={onRecord}>
              <Plus className="size-4" aria-hidden />
              {t("recordEvent")}
              <kbd className="ml-1 hidden rounded border border-primary-foreground/30 px-1 text-[10px] font-medium lg:inline">Ctrl K</kbd>
            </Button>
          ) : null}
          {canEdit ? (
            <Button type="button" variant="outline" className="hidden h-10 sm:inline-flex" onClick={onEdit}>
              {t("edit")}
            </Button>
          ) : null}
          <RowActionsMenu menuLabel={t("more")} actions={actions} />
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="hidden size-10 items-center justify-center rounded-md text-foreground hover:bg-muted sm:flex"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {visible.map((chip) => (
          <Chip key={chip.key} variant={chip.variant} className="max-w-[16rem] truncate" title={chip.label}>
            {chip.label}
          </Chip>
        ))}
        {hidden.length > 0 ? (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" aria-label={t("moreChipsLabel", { count: hidden.length })} className="rounded-full">
                <Chip variant="muted">{t("moreChips", { count: hidden.length })}</Chip>
              </button>
            </PopoverTrigger>
            <PopoverContent className="flex w-auto flex-wrap gap-2">
              {hidden.map((chip) => (
                <Chip key={chip.key} variant={chip.variant}>
                  {chip.label}
                </Chip>
              ))}
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
    </div>
  );
}
