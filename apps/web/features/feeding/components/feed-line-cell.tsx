"use client"; // controlled kg inputs with live stock clamping

import { useTranslations } from "next-intl";
import { AlertTriangle, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeedPlan } from "@/features/feed/plans-types";
import {
  clampKg,
  maxKgForLine,
  parseKg,
  sourceKey,
  type RowLine,
  type RowSource,
  type StockInfo,
} from "../grid-model";
import { FeedSourcePicker, type PreparedOption } from "./feed-source-picker";

const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

/** Enter → the next quantity input (next line or next cow), Shift+Enter → the previous one. */
function handleQtyKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const allInputs = Array.from(
    document.querySelectorAll<HTMLInputElement>(
      'input[data-grid-input="quantity"]:not([disabled])',
    ),
  );
  const currentIndex = allInputs.indexOf(e.currentTarget);
  if (currentIndex === -1) return;

  const targetIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1;
  const target = allInputs[targetIndex];
  if (target) {
    target.focus();
    target.select();
  }
}

interface Props {
  cowName: string;
  rowIndex: number;
  lines: RowLine[];
  /** Whether this cow's row is ticked — only ticked rows count toward the stock a source has left. */
  rowSelected: boolean;
  stock: Map<string, StockInfo>;
  /** Σ kg per source across every ticked row. */
  usage: Map<string, number>;
  preparedOptions: PreparedOption[];
  onChangeKg: (lineKey: string, kg: string) => void;
  onRemove: (lineKey: string) => void;
  onRemoveAll?: () => void;
  onAdd: (source: RowSource, name?: string) => void;
  onToggleSource?: (source: RowSource, name?: string) => void;
  onSelectPlan?: (plan: FeedPlan) => void;
  /** Called on any interaction so the row ticks itself, like editing a spreadsheet row. */
  onTouch: () => void;
  /** Σ kg of this cow's fed lines, shown under the lines. */
  total: number;
}

/**
 * The "Feed" cell of one cow's row: her feed lines stacked — a plan's lines pre-filled with the plan kg, a TMR /
 * concentrate as one line, or whatever was added by hand — each with its own kg input. Typing more than the
 * inventory has left is clamped to what is left (minus what other ticked cows already draw), so a row can never be
 * confirmed past stock.
 */
export function FeedLineCell({
  cowName,
  rowIndex,
  lines,
  rowSelected,
  stock,
  usage,
  preparedOptions,
  onChangeKg,
  onRemove,
  onRemoveAll,
  onAdd,
  onToggleSource,
  onSelectPlan,
  onTouch,
  total,
}: Props) {
  const t = useTranslations("feeding.grid.unified");

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-1.5">
      {lines.map((line, lineIndex) => {
        const info = line.source ? stock.get(sourceKey(line.source)) : undefined;
        const kg = parseKg(line.kg);
        const used = line.source ? (usage.get(sourceKey(line.source)) ?? 0) : 0;
        const max = line.source ? maxKgForLine(info, used, kg, rowSelected) : null;
        const over = max != null && kg > max + 0.001;
        const atCap = max != null && !over && kg > 0 && kg >= max - 0.001;
        const left = info?.availableKg != null ? info.availableKg - used : null;
        const name = line.name ?? info?.label ?? "…";
        const noBatch = line.source === null;

        return (
          <div key={line.key} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-foreground" title={name}>
                  {name}
                </span>
                {noBatch ? (
                  <span className="flex items-center gap-1 text-[11px] text-warning">
                    <AlertTriangle className="size-3" aria-hidden />
                    {t("noBatch")}
                  </span>
                ) : left != null ? (
                  <span className={cn("text-[11px] tabular-nums", left <= 0 ? "text-destructive" : "text-muted-foreground")}>
                    {left <= 0 ? t("outOfStock") : t("stockLeft", { kg: fmt(left) })}
                  </span>
                ) : null}
              </span>

              <div
                className={cn(
                  "flex h-8.5 w-28 shrink-0 items-center rounded-lg border bg-background px-2.5 shadow-2xs transition-all",
                  noBatch && "opacity-50",
                  over
                    ? "border-destructive focus-within:ring-2 focus-within:ring-destructive/20"
                    : "border-input/80 hover:border-input focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
                )}
              >
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={max != null ? Math.min(max, 300) : 300}
                  step={0.1}
                  placeholder="—"
                  disabled={noBatch}
                  value={line.kg}
                  data-grid-input="quantity"
                  data-row-index={rowIndex}
                  data-line-index={lineIndex}
                  aria-label={t("kgFor", { animal: cowName, feed: name })}
                  aria-invalid={over || undefined}
                  onChange={(e) => {
                    onTouch();
                    onChangeKg(line.key, clampKg(e.target.value, max).value);
                  }}
                  onFocus={(e) => {
                    onTouch();
                    e.target.select();
                  }}
                  onKeyDown={handleQtyKeyDown}
                  className="h-full w-full min-w-0 bg-transparent p-0 text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:cursor-not-allowed"
                />
                <span className="ml-1 shrink-0 text-xs font-medium text-muted-foreground/70">kg</span>
              </div>

              <button
                type="button"
                aria-label={t("removeLine", { feed: name })}
                onClick={() => {
                  onTouch();
                  onRemove(line.key);
                }}
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
            {over || atCap ? (
              <p role="status" className={cn("text-[11px]", over ? "text-destructive" : "text-warning")}>
                {t("maxInStock", { kg: fmt(max ?? 0) })}
              </p>
            ) : null}
          </div>
        );
      })}

      <div className="flex flex-col gap-1.5 pt-0.5">
        <div className="flex items-center justify-between gap-2">
          <FeedSourcePicker
            lines={lines}
            preparedOptions={preparedOptions}
            onSelect={onAdd}
            onToggleSource={onToggleSource}
            onSelectPlan={onSelectPlan}
            onOpen={onTouch}
          >
            {lines.length === 0 ? (
              <button
                type="button"
                className="flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-input bg-muted/20 px-3 text-left text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-card hover:text-foreground"
              >
                <Plus className="size-3" aria-hidden />
                {t("selectFeed")}
              </button>
            ) : (
              <button
                type="button"
                className="flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <Plus className="size-3.5" aria-hidden />
                {t("addFeed")}
              </button>
            )}
          </FeedSourcePicker>

          {lines.length > 0 && onRemoveAll ? (
            <button
              type="button"
              onClick={() => {
                onTouch();
                onRemoveAll();
              }}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label={t("removeAllLines", { animal: cowName })}
            >
              <Trash2 className="size-3" aria-hidden />
              {t("removeAll")}
            </button>
          ) : null}
        </div>

        {lines.length > 0 ? (
          <>
            <div className="border-t border-border/70 my-0.5" />

            {total > 0 ? (
              <div className="flex items-center gap-2">
                <span className="flex min-w-0 flex-1 items-center">
                  <span className="text-xs font-semibold text-muted-foreground">{t("total")}</span>
                </span>

                <div className="flex h-6 w-28 shrink-0 items-center px-2.5">
                  <span className="w-full text-sm font-semibold tabular-nums text-foreground">
                    {fmt(total)}
                  </span>
                  <span className="ml-1 shrink-0 text-xs font-medium text-muted-foreground/70">kg</span>
                </div>

                <div className="size-6 shrink-0" aria-hidden="true" />
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
