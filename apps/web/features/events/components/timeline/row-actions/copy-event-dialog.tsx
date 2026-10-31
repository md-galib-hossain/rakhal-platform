"use client"; // search state + list query

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCattleInfiniteList } from "@/features/cattle/hooks/use-cattle";
import { parseAsString, useQueryState } from "nuqs";
import type { EventKey } from "../../../types";

/** "Copy to another animal" (03 §3.4): pick an animal, then its workspace opens on the same kind of event form. */
export function CopyEventDialog({
  cattleId,
  eventKey,
  open,
  onOpenChange,
}: {
  cattleId: string;
  eventKey: EventKey;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("events.timeline.actions");
  const [search, setSearch] = useState("");
  // Same URL state the workspace reads (`?view=<id>&record=<key>`); the context itself is not imported (it would be an import cycle).
  const [, setView] = useQueryState("view", parseAsString);
  const [, setRecord] = useQueryState("record", parseAsString);
  const [, setRef] = useQueryState("ref", parseAsString);
  const list = useCattleInfiniteList({ search: search.trim() || undefined });
  const items = list.items.filter((animal) => animal.id !== cattleId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("copyTitle")}</DialogTitle>
          <DialogDescription>{t("copyHelp")}</DialogDescription>
        </DialogHeader>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("copySearch")}
          aria-label={t("copySearch")}
          className="h-11 rounded-md border border-border bg-background px-3 text-base text-foreground"
        />
        <ul className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto">
          {items.map((animal) => (
            <li key={animal.id}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center gap-2 px-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onOpenChange(false);
                  void setRef(null);
                  void setRecord(eventKey);
                  void setView(animal.id);
                }}
              >
                <span className="font-semibold">{animal.tagNumber}</span>
                {animal.name ? <span className="text-muted-foreground">{animal.name}</span> : null}
              </button>
            </li>
          ))}
          {!list.isLoading && items.length === 0 ? <li className="p-3 text-sm text-muted-foreground">{t("copyEmpty")}</li> : null}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
