"use client"; // popover state + live milk-eligibility query

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, BellPlus, ChevronDown, Pencil, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@rakhal/ui/ui/avatar";
import { Button } from "@rakhal/ui/ui/button";
import { Chip } from "@rakhal/ui/ui/chip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@rakhal/ui/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RowActionsMenu, type RowAction } from "@/components/shared/row-actions-menu";
import { useActiveLactation } from "@/features/reproduction/hooks/use-reproduction";
import { openRemindMe } from "@/features/notifications/sheet-store";
import { useMilkEligibility } from "@/features/milk/hooks/use-milk";
import { avatarTint } from "../../avatar-tint";
import type { CattleDetail } from "../../types";
import type { EventKey } from "@/features/events/types";
import { WorkspaceStats } from "./workspace-stats";

type ChipVariant = React.ComponentProps<typeof Chip>["variant"];
interface HeaderChip {
  key: string;
  label: string;
  variant: ChipVariant;
}

const MAX_VISIBLE_CHIPS = 3;
const MAX_QUICK_ACTIONS = 3;
/** Risk first, then production, then neutral lifecycle: the chips that need attention are never behind `+N`. */
const CHIP_RANK: Record<string, number> = { hold: 0, production: 1, pregnant: 2, category: 3, lactation: 4 };

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
  quickActions,
  onRecord,
  onQuickAction,
  onEdit,
  onClose,
}: {
  cattle: CattleDetail;
  titleRef: React.RefObject<HTMLHeadingElement | null>;
  actions: RowAction[];
  canEdit: boolean;
  canRecord: boolean;
  /** State-driven shortcuts (`quickActionsFor`), already filtered by RBAC and eligibility. */
  quickActions: EventKey[];
  onRecord: () => void;
  onQuickAction: (key: EventKey) => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("events.workspace");
  const tc = useTranslations("cattle.detail");
  const tOverview = useTranslations("events.workspace.overview");
  const tCatalogue = useTranslations("events.catalogue");
  const eligibility = useMilkEligibility(cattle.gender === "FEMALE" ? cattle.id : undefined).data;

  const chips = useMemo<HeaderChip[]>(() => {
    const list: HeaderChip[] = [];
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
    return list.sort((a, b) => (CHIP_RANK[a.key] ?? 9) - (CHIP_RANK[b.key] ?? 9));
  }, [cattle, eligibility, t, tc]);

  const lactation = useActiveLactation(cattle.gender === "FEMALE" ? cattle.id : undefined).data;
  const age = ageParts(cattle.dateOfBirth);
  const subtitle = [
    age ? t("ageValue", age) : null,
    tc(`animalCategoryOptions.${cattle.animalCategory}`),
    lactation ? tOverview("glance.ordinal", { n: lactation.lactationNumber }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const visible = chips.slice(0, MAX_VISIBLE_CHIPS);
  const hidden = chips.slice(MAX_VISIBLE_CHIPS);
  const hasName = Boolean(cattle.name);

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("back")}
          className="-ml-1 mt-1 flex size-10 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-muted sm:hidden"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <Avatar className="size-12 shrink-0 rounded-xl sm:size-14">
          {cattle.profile_photo ? <AvatarImage src={cattle.profile_photo.thumb_url} alt="" /> : null}
          <AvatarFallback className={cn("rounded-xl text-lg", avatarTint(cattle.id))}>
            {(cattle.name ?? cattle.tagNumber).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 basis-40 flex-col gap-0.5">
          <h2 ref={titleRef} tabIndex={-1} className="truncate text-xl font-bold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {hasName ? cattle.name : cattle.tagNumber}
            {hasName ? <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">{cattle.tagNumber}</span> : null}
          </h2>
          {subtitle ? <p className="truncate text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {canRecord ? (
            <div className="hidden items-stretch sm:flex">
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" className="h-10 gap-1.5 rounded-r-none" onClick={onRecord}>
                      <Plus className="size-4" aria-hidden />
                      {t("recordEvent")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("shortcutHint")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" aria-label={t("quickMenu")} className="h-10 w-9 rounded-l-none border-l border-primary-foreground/30 px-0">
                    <ChevronDown className="size-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-48">
                  {quickActions.slice(0, MAX_QUICK_ACTIONS).map((key) => (
                    <DropdownMenuItem key={key} onSelect={() => onQuickAction(key)}>
                      {tCatalogue(`${key}.label`)}
                    </DropdownMenuItem>
                  ))}
                  {quickActions.length > 0 ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuItem onSelect={onRecord}>{t("allEvents")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
          {canRecord ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-10 shrink-0 rounded-lg"
              aria-label={t("remindMe")}
              title={t("remindMe")}
              onClick={() => openRemindMe({ animal: { id: cattle.id, tagNumber: cattle.tagNumber, name: cattle.name } })}
            >
              <BellPlus className="size-4" aria-hidden />
            </Button>
          ) : null}
          {canEdit ? (
            <Button type="button" variant="outline" className="hidden h-10 gap-1.5 rounded-lg sm:inline-flex" onClick={onEdit}>
              <Pencil className="size-4" aria-hidden />
              {t("edit")}
            </Button>
          ) : null}
          <div className="hidden sm:block">
            <RowActionsMenu menuLabel={t("more")} actions={actions} className="size-10" />
          </div>
          <div className="sm:hidden">
            <RowActionsMenu
              menuLabel={t("more")}
              className="size-10"
              actions={canEdit ? [{ key: "edit", label: t("edit"), onSelect: onEdit }, ...actions] : actions}
            />
          </div>
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
          <Chip key={chip.key} variant={chip.variant} subtle={chip.key === "production" && chip.variant === "primary"} className={cn("max-w-[16rem] truncate", chip.key === "production" && chip.variant === "primary" && "border-primary bg-primary text-primary-foreground")} title={chip.label}>
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
      <WorkspaceStats cattle={cattle} />
    </div>
  );
}
