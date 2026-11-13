"use client"; // search state, media query, localStorage "recent", keyboard navigation

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlarmClock,
  AlertTriangle,
  ArrowLeftRight,
  Baby,
  Banknote,
  Gauge,
  Heart,
  Milk,
  PauseCircle,
  Pill,
  Scale,
  Scissors,
  Skull,
  StickyNote,
  Stethoscope,
  Syringe,
  TrendingDown,
  TrendingUp,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useCan } from "@/lib/auth/permissions";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { Button } from "@rakhal/ui/ui/button";
import { Chip } from "@rakhal/ui/ui/chip";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@rakhal/ui/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@rakhal/ui/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@rakhal/ui/ui/sheet";
import { useUpcomingEvents } from "@/features/cattle/hooks/use-cattle";
import type { CattleDetail } from "@/features/cattle/types";
import { deriveChips } from "../../catalogue/chips";
import type { AnimalChip, EligibilityReason, EventKey } from "../../types";
import {
  buildPickerModel,
  loadRecent,
  pushRecent,
  suggestedFromUpcoming,
  type PickerEntry,
} from "./picker-model";

const ICONS: Record<string, LucideIcon> = {
  AlarmClock, AlertTriangle, ArrowLeftRight, Baby, Banknote, Gauge, Heart, Milk, PauseCircle, Pill, Scale, Scissors,
  Skull, StickyNote, Stethoscope, Syringe, TrendingDown, TrendingUp, XCircle,
};

/**
 * Event picker (RFE-157, 03 §4): a command palette on ≥640px and a 92dvh bottom sheet on phones. One search box
 * (English + Bangla synonyms from the catalogue i18n), the animal's derived category chips, then Suggested (from
 * Next up), Recent, and the groups. Events that do not fit the animal are hidden; a search that matches one shows it
 * greyed with the reason, and "Show all events" reveals them all. Only events the role may record are ever listed.
 */
export function EventPicker({
  open,
  onOpenChange,
  animal,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  animal: CattleDetail;
  onPick: (key: EventKey) => void;
}) {
  const t = useTranslations("events.picker");
  const desktop = useMediaQuery("(min-width: 640px)");
  const title = t("title", { name: animal.name ?? animal.tagNumber });

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showClose={false} className="top-[10vh] max-h-[640px] w-[560px] max-w-[calc(100vw-2rem)] translate-y-0 gap-0 overflow-hidden p-0">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <PickerBody animal={animal} title={title} onPick={onPick} onClose={() => onOpenChange(false)} />
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showClose={false} className="flex h-[92dvh] flex-col gap-0 rounded-t-2xl p-0">
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border" aria-hidden />
        <PickerBody animal={animal} title={title} onPick={onPick} onClose={() => onOpenChange(false)} mobile />
      </SheetContent>
    </Sheet>
  );
}

function PickerBody({
  animal,
  title,
  mobile,
  onPick,
  onClose,
}: {
  animal: CattleDetail;
  title: string;
  mobile?: boolean;
  onPick: (key: EventKey) => void;
  onClose: () => void;
}) {
  const t = useTranslations("events.picker");
  const tw = useTranslations("events.warn");
  const tr = useTranslations("events.reason");
  const tChip = useTranslations("events.chip");
  const tGroup = useTranslations("events.group");
  const tCatalogue = useTranslations("events.catalogue");
  const can = useCan();
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [recentKeys] = useState<EventKey[]>(() => loadRecent());
  const upcoming = useUpcomingEvents(animal.id, true);

  const chips = useMemo(() => [...deriveChips(animal)], [animal]);
  const model = buildPickerModel({
    facts: animal,
    can,
    textFor: (key) => ({ label: tCatalogue(`${key}.label`), hint: tCatalogue(`${key}.hint`), synonyms: tCatalogue(`${key}.synonyms`) }),
    query,
    showAll,
    suggestedKeys: suggestedFromUpcoming(upcoming.data?.events ?? []),
    recentKeys,
  });
  const nothing = model.suggested.length + model.recent.length + model.groups.length + model.unavailable.length === 0;

  function reasonText(reason: EligibilityReason): string {
    if (reason.key === "notFor") return tr("notFor", { chip: reason.chip });
    if (reason.key === "onlyFor") return tr("onlyFor", { chips: reason.chips.map((chip) => tChip(chip)).join(", ") });
    return tr(reason.key);
  }

  function choose(key: EventKey) {
    pushRecent(key);
    onPick(key);
  }

  function row(entry: PickerEntry, section: string) {
    const Icon = ICONS[entry.def.icon] ?? StickyNote;
    const blocked = entry.eligibility.status === "block";
    const detail =
      entry.eligibility.status === "block"
        ? reasonText(entry.eligibility.reason)
        : entry.eligibility.status === "warn"
          ? tw("unusualFor", { chips: entry.eligibility.chips.map((chip: AnimalChip) => tChip(chip)).join(", ") })
          : entry.text.hint;
    return (
      <CommandItem
        key={`${section}:${entry.def.key}`}
        value={`${section}:${entry.def.key}`}
        disabled={blocked}
        onSelect={() => choose(entry.def.key)}
        className="min-h-12 gap-3 py-2"
      >
        <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex min-w-0 flex-col">
          <span className="font-medium">{entry.text.label}</span>
          <span className={blocked ? "text-xs text-muted-foreground" : entry.eligibility.status === "warn" ? "text-xs text-warning" : "text-xs text-muted-foreground"}>
            {detail}
          </span>
        </span>
      </CommandItem>
    );
  }

  return (
    <Command shouldFilter={false} className="flex min-h-0 flex-1 flex-col rounded-none bg-card" label={title}>
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        {mobile ? (
          <Button type="button" variant="ghost" size="icon" aria-label={t("back")} onClick={onClose}>
            <X className="size-4" aria-hidden />
          </Button>
        ) : null}
      </div>
      <CommandInput value={query} onValueChange={setQuery} placeholder={t("searchPlaceholder")} className="text-base sm:text-sm" />
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2">
        <span className="text-xs text-muted-foreground">{t("animal")}:</span>
        {chips.map((chip) => (
          <Chip key={chip} variant="muted">
            {tChip(chip)}
          </Chip>
        ))}
      </div>
      <CommandList className="max-h-none min-h-0 flex-1 p-1 sm:max-h-[420px]">
        {nothing ? <CommandEmpty>{t("noResults")}</CommandEmpty> : null}
        {model.suggested.length > 0 ? (
          <CommandGroup heading={t("suggested")}>{model.suggested.map((entry) => row(entry, "suggested"))}</CommandGroup>
        ) : null}
        {model.recent.length > 0 ? <CommandGroup heading={t("recent")}>{model.recent.map((entry) => row(entry, "recent"))}</CommandGroup> : null}
        {model.groups.map((group) => (
          <CommandGroup key={group.group} heading={tGroup(group.group)}>
            {group.entries.map((entry) => row(entry, group.group))}
          </CommandGroup>
        ))}
        {model.unavailable.length > 0 ? (
          <CommandGroup heading={t("unavailable")}>{model.unavailable.map((entry) => row(entry, "unavailable"))}</CommandGroup>
        ) : null}
      </CommandList>
      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <span className="hidden text-xs text-muted-foreground sm:inline">{t("keys")}</span>
        {query.trim() ? null : (
          <Button type="button" variant="ghost" size="sm" className="ml-auto h-9" onClick={() => setShowAll((value) => !value)}>
            {showAll ? t("hideUnavailable") : t("showAll")}
          </Button>
        )}
      </div>
    </Command>
  );
}
