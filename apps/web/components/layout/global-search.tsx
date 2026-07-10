"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandInput, CommandList } from "@/components/ui/command";

/**
 * ⌘K global search palette. RFE-005's scope is the topbar "search placeholder" per
 * PROJECT_PROGRESS.md — this wires the palette's open/close + keyboard shortcut only. Live results
 * against `GET /search` (§19 of Rakhal_API.md) land with a future ticket.
 */
export function GlobalSearch() {
  const t = useTranslations("topbar");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-9 w-full max-w-[320px] justify-start gap-2 rounded-lg border-border bg-card font-normal text-muted-foreground shadow-xs"
      >
        <Search className="size-[18px]" />
        <span className="hidden sm:inline">{t("searchPlaceholder")}</span>
        <kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 py-0.5 text-xs sm:inline">
          ⌘K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={t("searchPlaceholder")} />
        <CommandList>
          <CommandEmpty>No results found</CommandEmpty>
        </CommandList>
      </CommandDialog>
    </>
  );
}
