"use client"; // scope/date-range selection state + a one-shot download fetch

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { format, startOfMonth, startOfWeek, subDays } from "date-fns";
import { CalendarDays } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { milkApi } from "../api";
import type { MilkLogRow } from "../types";

function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

type Preset = "today" | "week" | "month" | "custom";
type Scope = "all" | "select";

function presetRange(preset: Preset): { from: string; to: string } {
  const today = new Date();
  if (preset === "week") return { from: format(startOfWeek(today), "yyyy-MM-dd"), to: todayIso() };
  if (preset === "month") return { from: format(startOfMonth(today), "yyyy-MM-dd"), to: todayIso() };
  return { from: todayIso(), to: todayIso() };
}

/** Export modal (Figma-less, no spec provided) — scope (all cows vs a multi-select subset) +
 * date range (Today/This week/This month presets, or a custom from/to pair — no shared
 * date-range picker exists yet in this codebase, so this builds its own minimal one), then
 * downloads `.xlsx` via `milkApi.exportLog` (bespoke byte-stream route, not the JSON `apiFetch`
 * path — see `app/api/milk/export/route.ts`). */
export function MilkExportDialog({
  open,
  onOpenChange,
  cattleOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cattleOptions: MilkLogRow[];
}) {
  const t = useTranslations("milk.export");
  const [scope, setScope] = useState<Scope>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [preset, setPreset] = useState<Preset>("week");
  const [customFrom, setCustomFrom] = useState(() => format(subDays(new Date(), 6), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState(() => todayIso());
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const range = useMemo(
    () => (preset === "custom" ? { from: customFrom, to: customTo } : presetRange(preset)),
    [preset, customFrom, customTo],
  );

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function reset() {
    setScope("all");
    setSelectedIds(new Set());
    setPreset("week");
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleExport() {
    if (scope === "select" && selectedIds.size === 0) {
      toast.error(t("noCowsSelected"));
      return;
    }
    setIsExporting(true);
    try {
      const blob = await milkApi.exportLog({
        from: range.from,
        to: range.to,
        cattleIds: scope === "select" ? [...selectedIds] : undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `milk-log_${range.from}_${range.to}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t("exportedToast"));
      handleOpenChange(false);
    } catch {
      toast.error(t("exportError"));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label>{t("scopeLabel")}</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("scopeAll")}</SelectItem>
                <SelectItem value="select">{t("scopeSelect")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === "select" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("cowsLabel")}</Label>
                <button
                  type="button"
                  className="text-xs font-medium text-primary underline underline-offset-2"
                  onClick={() =>
                    setSelectedIds(
                      selectedIds.size === cattleOptions.length
                        ? new Set()
                        : new Set(cattleOptions.map((c) => c.cattleId)),
                    )
                  }
                >
                  {selectedIds.size === cattleOptions.length ? t("deselectAll") : t("selectAll")}
                </button>
              </div>
              <div className="max-h-48 overflow-auto rounded-lg border border-border p-2">
                {cattleOptions.map((cow) => (
                  <label key={cow.cattleId} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted">
                    <Checkbox
                      checked={selectedIds.has(cow.cattleId)}
                      onCheckedChange={() => toggleId(cow.cattleId)}
                    />
                    <span className="text-foreground">{cow.name ?? cow.tag}</span>
                    <span className="text-xs text-muted-foreground">{cow.tag}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>{t("rangeLabel")}</Label>
            <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">{t("rangeToday")}</SelectItem>
                <SelectItem value="week">{t("rangeWeek")}</SelectItem>
                <SelectItem value="month">{t("rangeMonth")}</SelectItem>
                <SelectItem value="custom">{t("rangeCustom")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {preset === "custom" ? (
            <div className="flex items-center gap-2">
              <Popover open={fromOpen} onOpenChange={setFromOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 flex-1 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground"
                  >
                    {customFrom}
                    <CalendarDays className="size-3.5" aria-hidden />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={new Date(customFrom)}
                    onSelect={(next) => {
                      if (!next) return;
                      setCustomFrom(format(next, "yyyy-MM-dd"));
                      setFromOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">{t("rangeTo")}</span>
              <Popover open={toOpen} onOpenChange={setToOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 flex-1 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground"
                  >
                    {customTo}
                    <CalendarDays className="size-3.5" aria-hidden />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={new Date(customTo)}
                    onSelect={(next) => {
                      if (!next) return;
                      setCustomTo(format(next, "yyyy-MM-dd"));
                      setToOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          ) : null}
        </div>

        <SheetFooter className="border-t border-dashed border-border pt-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? "…" : t("exportAction")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
