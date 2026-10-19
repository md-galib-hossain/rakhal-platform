"use client"; // popover open + search state, plan / recipe queries

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChefHat, ClipboardList, Wheat } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useConcentrations } from "../../feed/hooks/use-feed";
import { useFeedPlansList } from "../../feed/hooks/use-feed-plans";
import type { ApplyTarget } from "../../feed/components/plans/apply-plan-dialog";
import { TruncatedText } from "@/components/shared/truncated-text";

/**
 * "Which program?" — one search list over everything that can be applied to a cow: her feed plans (a plan is a group of
 * feed items with kg), and the TMR / concentrate recipes from Feed Formulator (applying one turns it into a one-line
 * plan). Picking hands an `ApplyTarget` to the caller, who opens the shared apply dialog.
 */
export function ProgramPicker({
  onPick,
  children,
  align = "start",
}: {
  onPick: (target: ApplyTarget) => void;
  children: ReactNode;
  align?: "start" | "center" | "end";
}) {
  const t = useTranslations("feeding.grid.unified.programPicker");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
      modal={false}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-0 shadow-lg" align={align}>
        {open ? (
          <Body
            search={search}
            onSearchChange={setSearch}
            onPick={(target) => {
              setOpen(false);
              onPick(target);
            }}
            t={t}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function Body({
  search,
  onSearchChange,
  onPick,
  t,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  onPick: (target: ApplyTarget) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const plans = useFeedPlansList({ search: search.trim() || undefined });
  const recipes = useConcentrations();
  const q = search.trim().toLowerCase();

  const planItems = useMemo(() => plans.items.filter((p) => p.is_active && p.kind === "PLAN"), [plans.items]);
  // A recipe with no batch made yet has nothing to feed from, so it isn't offered.
  const tmrs = useMemo(
    () =>
      (recipes.data ?? []).filter(
        (r) => r.kind === "FEED_MIXTURE" && r.is_finalized && (!q || r.name.toLowerCase().includes(q)),
      ),
    [recipes.data, q],
  );
  const concentrates = useMemo(
    () =>
      (recipes.data ?? []).filter(
        (r) => r.kind === "CONCENTRATE_TEMPLATE" && r.is_finalized && (!q || r.name.toLowerCase().includes(q)),
      ),
    [recipes.data, q],
  );

  return (
    <Command shouldFilter={false}>
      <CommandInput placeholder={t("search")} value={search} onValueChange={onSearchChange} />
      <CommandList className="max-h-72">
        <CommandEmpty>{plans.isLoading || recipes.isLoading ? "…" : t("none")}</CommandEmpty>
        {planItems.length > 0 ? (
          <CommandGroup heading={t("plans")}>
            {planItems.map((p) => (
              <CommandItem
                key={p.id}
                value={`plan-${p.id}`}
                onSelect={() => onPick({ kind: "plan", plan: { id: p.id, name: p.name } })}
                className="flex cursor-pointer items-center gap-2 py-2"
              >
                <ClipboardList className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex min-w-0 flex-col">
                  <TruncatedText>{p.name}</TruncatedText>
                  <span className="text-xs text-muted-foreground">
                    {t("planLines", { count: p.lines.length, kg: p.total_kg_per_day })}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {tmrs.length > 0 ? (
          <CommandGroup heading={t("tmr")}>
            {tmrs.map((r) => (
              <CommandItem
                key={r.id}
                value={`tmr-${r.id}`}
                onSelect={() => onPick({ kind: "shortcut", concentration: r })}
                className="flex cursor-pointer items-center gap-2 py-2"
              >
                <Wheat className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <TruncatedText>{r.name}</TruncatedText>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {concentrates.length > 0 ? (
          <CommandGroup heading={t("concentrate")}>
            {concentrates.map((r) => (
              <CommandItem
                key={r.id}
                value={`conc-${r.id}`}
                onSelect={() => onPick({ kind: "shortcut", concentration: r })}
                className="flex cursor-pointer items-center gap-2 py-2"
              >
                <ChefHat className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <TruncatedText>{r.name}</TruncatedText>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </Command>
  );
}
