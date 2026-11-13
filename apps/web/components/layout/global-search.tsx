"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Button } from "@rakhal/ui/ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useGlobalSearch } from "@/features/search/hooks/use-search";
import type { SearchHit, SearchResults } from "@/features/search/types";

const emptySubscribe = () => () => {};

/** SSR always assumes non-Mac (`Ctrl K`) — flips to `⌘ K` after hydration on real Mac clients.
 * Mirrors the `useMounted` pattern `ThemeToggle` already uses for the same class of check. */
function useIsMac() {
  return useSyncExternalStore(
    emptySubscribe,
    () => typeof navigator !== "undefined" && /mac/i.test(navigator.userAgent),
    () => false,
  );
}

/** Render order for `GET /search`'s result groups — cattle first (the app's own primary entity),
 * matching `search.service.ts`'s own field order. */
const GROUP_ORDER: (keyof SearchResults)[] = ["cattle", "tasks", "suppliers", "buyers", "sheds", "medicines"];

/**
 * ⌘K/Ctrl-K global search palette (RFE-044). RFE-005 shipped the topbar placeholder + open/close +
 * keyboard shortcut only; this wires real results against `GET /search?q=` (RAKHAL-257, already
 * live on the backend — confirmed by reading `search.service.ts`/`search.controller.ts` directly)
 * grouped by entity, navigating via each hit's own server-provided `link` on select.
 *
 * `shouldFilter={false}` on `CommandDialog` (widened in `components/ui/command.tsx` for this one
 * caller): results are already server-scored/filtered (Postgres trigram similarity, not a plain
 * substring match), so cmdk's own client-side fuzzy re-filter over `CommandItem`'s `value` would at
 * best duplicate that work and at worst silently hide a real backend match its own scorer disagrees
 * with — same reasoning `select-case-dialog.tsx` already applies to its own server-driven list.
 */
export function GlobalSearch() {
  const t = useTranslations("topbar");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const isMac = useIsMac();
  const search = useGlobalSearch(query);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        // MILESTONE 31 (RFE-157): while the Animal Workspace is open, Ctrl/Cmd+K belongs to its event picker.
        if (document.querySelector("[data-animal-workspace]")) return;
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setQuery("");
  }

  function handleSelect(hit: SearchHit) {
    setOpen(false);
    setQuery("");
    router.push(hit.link);
  }

  const trimmed = query.trim();
  const results = search.data?.results;
  const hasResults = results ? GROUP_ORDER.some((key) => results[key].length > 0) : false;

  let emptyMessage = t("search.noResults");
  if (trimmed.length < 2) emptyMessage = t("search.minChars");
  else if (search.isLoading) emptyMessage = t("search.searching");
  else if (search.isError) emptyMessage = t("search.error");

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-10 w-full max-w-[320px] justify-start gap-2 rounded-lg border-border bg-card font-normal text-muted-foreground shadow-xs"
      >
        <Search className="size-[18px]" />
        <span className="hidden truncate sm:inline">{t("searchPlaceholder")}</span>
        <kbd className="ml-auto hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-xs sm:inline">
          {isMac ? t("searchShortcutMac") : t("searchShortcutWin")}
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={handleOpenChange} shouldFilter={false}>
        <CommandInput placeholder={t("searchPlaceholder")} value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>{emptyMessage}</CommandEmpty>
          {hasResults && results
            ? GROUP_ORDER.map((key) =>
                results[key].length > 0 ? (
                  <CommandGroup key={key} heading={t(`search.groups.${key}`)}>
                    {results[key].map((hit) => (
                      <CommandItem key={hit.id} value={hit.id} onSelect={() => handleSelect(hit)}>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate">{hit.label}</span>
                          {hit.sublabel ? (
                            <span className="truncate text-xs text-muted-foreground">{hit.sublabel}</span>
                          ) : null}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null,
              )
            : null}
        </CommandList>
      </CommandDialog>
    </>
  );
}
