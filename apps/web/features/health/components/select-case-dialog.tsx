"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { healthApi } from "../api";

/** Backing dialog for the Health Management Center's header "Log Treatment" button — that action
 * has no target case yet (unlike a row's "Manage Case"), and no Figma frame covers this picker
 * step, so it's a small search-select over the real `GET /health/sick-bay` list that then opens the
 * Case Management sheet on the Log Treatment tab for whichever case is chosen. */
export function SelectCaseDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (caseId: string) => void;
}) {
  const t = useTranslations("health.selectCase");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["health-select-case", search],
    queryFn: () => healthApi.sickBay({ search: search || undefined }),
    enabled: open,
    staleTime: 15_000,
  });
  const items = data?.items ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-md">
        <SheetHeader className="p-4 pb-0">
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>
        <Command shouldFilter={false}>
          <CommandInput placeholder={t("searchPlaceholder")} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{isLoading ? t("searching") : t("noCases")}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => {
                    onSelect(item.id);
                    onOpenChange(false);
                  }}
                >
                  <div className="flex flex-col">
                    <span>{item.cattle.name ?? item.cattle.tagNumber} — {item.diagnosis}</span>
                    <span className="text-xs text-muted-foreground">{item.cattle.tagNumber}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </SheetContent>
    </Sheet>
  );
}
