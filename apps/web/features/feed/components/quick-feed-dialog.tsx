"use client"; // form state + a real mutation on submit

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine, Plus } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { LabeledInput, LabeledSelectTrigger } from "@/components/ui/labeled-field";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import { CattlePicker } from "@/components/shared/cattle-picker";
import { cn } from "@/lib/utils";
import { useFeedItemPagedList } from "@/features/inventory/hooks/use-inventory";
import { FeedItemFormDialog } from "@/features/inventory/components/feed-item-form-dialog";
import { useFeedGroups, useQuickFeed } from "../hooks/use-feed";
import type { FeedTargetType } from "../types";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const QUICK_FEED_TARGETS: FeedTargetType[] = ["INDIVIDUAL", "GROUP", "HERD"];

/** Sentinel `<SelectItem>` value picked to open the nested "create feed item" sheet instead of
 * selecting an item — same trick as `components/shared/creatable-select.tsx`'s `CREATE_NEW`. Not
 * reusing that component directly: a feed item needs its full multi-field form
 * (`FeedItemFormDialog`), not the name-only inline row `CreatableSelect` offers. */
const CREATE_NEW_FEED_ITEM = "__create_new_feed_item__";

/**
 * "Quick Feed" (2026-08-13, user request) — feed a single raw inventory item (grass, silage)
 * straight to a cow/group/herd, no `FeedConcentration` involved. Own lightweight path per the
 * user's own confirmed preference — not a fake 1-ingredient Concentration wrapper. Mirrors
 * `log-distribution-dialog.tsx`'s Sheet shell for visual consistency, but this dialog picks its
 * own item + target (a "Feed Today" TMR dialog derives both from an existing Concentration).
 */
export function QuickFeedDialog({
  open,
  onOpenChange,
  initialCattleId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCattleId?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? <QuickFeedDialogBody onOpenChange={onOpenChange} initialCattleId={initialCattleId} /> : null}
    </Sheet>
  );
}

function QuickFeedDialogBody({
  onOpenChange,
  initialCattleId,
}: {
  onOpenChange: (open: boolean) => void;
  initialCattleId?: string;
}) {
  const t = useTranslations("feed.quickFeed");
  const feedItems = useFeedItemPagedList({});
  const feedGroups = useFeedGroups();
  const quickFeed = useQuickFeed();

  const [feedItemId, setFeedItemId] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [targetType, setTargetType] = useState<FeedTargetType>(initialCattleId ? "INDIVIDUAL" : "GROUP");
  const [feedGroupId, setFeedGroupId] = useState<string | undefined>(undefined);
  const [cattleId, setCattleId] = useState<string | undefined>(initialCattleId);
  const [distributedAt, setDistributedAt] = useState(todayStr());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createItemOpen, setCreateItemOpen] = useState(false);

  const selectedItem = feedItems.items.find((i) => i.id === feedItemId);
  const quantity = Number(quantityKg) || 0;
  const canSubmit =
    Boolean(feedItemId) &&
    quantity > 0 &&
    (targetType === "HERD" || (targetType === "GROUP" && Boolean(feedGroupId)) || (targetType === "INDIVIDUAL" && Boolean(cattleId)));

  async function handleConfirm() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await quickFeed.mutateAsync({
        feedItemId,
        quantityKg: quantity,
        targetType,
        feedGroupId: targetType === "GROUP" ? feedGroupId : undefined,
        cattleId: targetType === "INDIVIDUAL" ? cattleId : undefined,
        distributedAt: distributedAt || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(t("loggedToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SheetContent
      showClose={false}
      className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[600px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[600px]"
    >
      <div className="flex items-start justify-between pb-5">
        <SheetTitle className="text-xl font-bold text-foreground">{t("title")}</SheetTitle>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={t("close")}
          className="flex size-5 shrink-0 items-center justify-center text-foreground transition-opacity hover:opacity-70"
        >
          <ArrowRightToLine className="size-5" aria-hidden />
        </button>
      </div>
      <div className="border-t border-dashed border-border" />

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto py-4">
        <Select
          value={feedItemId}
          onValueChange={(v) => {
            if (v === CREATE_NEW_FEED_ITEM) {
              // Deferred: opening a Sheet synchronously from a Select's `onValueChange` lets the new
              // Sheet's dismissable-layer catch the tail of the same click/pointer event as an
              // "outside click" and close itself on the same frame it opened — visible as a flicker,
              // not a real open. Pushing the state update to the next tick lets that event finish
              // first.
              setTimeout(() => setCreateItemOpen(true), 0);
              return;
            }
            setFeedItemId(v);
          }}
        >
          <LabeledSelectTrigger label={t("selectItem")} placeholder={t("selectItemPlaceholder")} />
          <SelectContent>
            {feedItems.items.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name} ({item.currentStock} {item.unit.symbol})
              </SelectItem>
            ))}
            <SelectItem value={CREATE_NEW_FEED_ITEM} className="text-primary">
              <span className="flex items-center gap-1.5">
                <Plus className="size-3.5" aria-hidden />
                {t("createItem")}
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
        <FeedItemFormDialog
          open={createItemOpen}
          onOpenChange={setCreateItemOpen}
          onCreated={(item) => setFeedItemId(item.id)}
        />

        <LabeledInput
          id="quantityKg"
          type="number"
          min={0.01}
          step="0.01"
          label={t("quantityKg")}
          value={quantityKg}
          onChange={(e) => setQuantityKg(e.target.value)}
        />
        {selectedItem ? (
          <p className="text-xs text-muted-foreground">
            {t("estimatedCost", { value: (quantity * (selectedItem.costPerUnit || 0)).toFixed(2) })}
          </p>
        ) : null}

        <div className="flex h-12 gap-1 rounded-xl border border-border bg-muted p-1">
          {QUICK_FEED_TARGETS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTargetType(value)}
              className={cn(
                "flex flex-1 items-center justify-center rounded-lg text-sm font-bold transition-colors",
                targetType === value ? "bg-card text-primary shadow-xs" : "text-muted-foreground",
              )}
            >
              {t(`target.${value}`)}
            </button>
          ))}
        </div>

        {targetType === "GROUP" ? (
          <Select value={feedGroupId} onValueChange={setFeedGroupId}>
            <LabeledSelectTrigger label={t("selectGroup")} placeholder={t("selectGroupPlaceholder")} />
            <SelectContent>
              {(feedGroups.data ?? []).map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name} ({t("cowCount", { count: group.assigned_count })})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : targetType === "INDIVIDUAL" ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">{t("selectAnimal")}</p>
            <CattlePicker value={cattleId} onValueChange={setCattleId} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("herdTargetHint")}</p>
        )}

        <LabeledInput
          id="distributedAt"
          type="date"
          label={t("date")}
          value={distributedAt}
          onChange={(e) => setDistributedAt(e.target.value)}
        />

        <LabeledInput
          id="notes"
          label={t("notes")}
          placeholder={t("notesPlaceholder")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="border-t border-dashed border-border" />
      <div className="flex gap-2 pt-5">
        <Button type="button" variant="secondary" className="h-[52px] flex-1 rounded-xl" onClick={() => onOpenChange(false)} disabled={submitting}>
          {t("cancel")}
        </Button>
        <Button type="button" className="h-[52px] flex-1 rounded-xl" onClick={handleConfirm} disabled={submitting || !canSubmit}>
          {submitting ? "…" : t("confirm")}
        </Button>
      </div>
    </SheetContent>
  );
}
