"use client"; // search-select over the ServiceProvider directory + a quick-add form

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { LabeledInput } from "@/components/ui/labeled-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateServiceProvider } from "../hooks/use-workspace-mutations";
import { useServiceProviders } from "../hooks/use-workspace";
import type { ServiceProvider, ServiceProviderType } from "../types";

/**
 * AI technician / vet picker (Reproduction's Record AI form, `semenSource: "TECHNICIAN_SUPPLIED"` —
 * a traveling AI technician brings his own semen, the farm never owns that stock, so no inventory
 * batch exists to pick). Same Popover+Command search-select + inline quick-add shape as
 * `features/inventory/components/unit-picker.tsx` (that component's own doc comment names
 * `features/feed/components/ingredient-picker.tsx` as the original pattern) — flat list here since
 * `ServiceProvider` has no grouping dimension the way units/ingredients do.
 */
export function ServiceProviderPicker({
  value,
  onChange,
  placeholder,
  className,
  error,
}: {
  value: string | undefined;
  onChange: (serviceProviderId: string) => void;
  placeholder?: string;
  className?: string;
  error?: string;
}) {
  const t = useTranslations("settings.serviceProviderPicker");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"search" | "custom">("search");
  const [customName, setCustomName] = useState("");
  const [customPhone, setCustomPhone] = useState("");
  const [customType, setCustomType] = useState<ServiceProviderType>("AI_TECHNICIAN");

  const { data, isLoading } = useServiceProviders();
  const providers = useMemo(() => data?.service_providers ?? [], [data]);
  const createCustom = useCreateServiceProvider();

  const selected = useMemo(() => providers.find((p) => p.id === value), [providers, value]);

  const filtered = useMemo(
    () => providers.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [providers, search],
  );

  function reset() {
    setSearch("");
    setMode("search");
    setCustomName("");
    setCustomPhone("");
    setCustomType("AI_TECHNICIAN");
  }

  function selectProvider(provider: ServiceProvider) {
    onChange(provider.id);
    setOpen(false);
    reset();
  }

  async function submitCustom() {
    if (!customName.trim()) return;
    const created = await createCustom.mutateAsync({
      name: customName.trim(),
      phone: customPhone.trim() || undefined,
      type: customType,
    });
    selectProvider(created);
  }

  return (
    <div className={cn("w-full", className)}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
        // Same `modal={false}` defense-in-depth as `UnitPicker`/`IngredientPicker` — never installs
        // its own scroll lock when reused inside a form dialog.
        modal={false}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-xl border border-input bg-card px-4 py-2 text-left shadow-xs transition-colors focus-within:ring-2 focus-within:ring-ring",
              error && "border-destructive focus-within:ring-destructive",
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={cn("truncate text-sm", selected ? "text-foreground" : "text-muted-foreground")}>
                {selected ? selected.name : (placeholder ?? t("selectProvider"))}
              </span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0">
          {mode === "search" ? (
            <Command shouldFilter={false}>
              <CommandInput placeholder={t("searchProvider")} value={search} onValueChange={setSearch} />
              <CommandList>
                <CommandEmpty>{isLoading ? t("loading") : t("noProvidersFound")}</CommandEmpty>
                <CommandGroup>
                  {filtered.map((provider) => (
                    <CommandItem key={provider.id} value={provider.id} onSelect={() => selectProvider(provider)}>
                      <Check className={cn("mr-2 size-4", provider.id === value ? "opacity-100" : "opacity-0")} aria-hidden />
                      <span className="flex flex-col">
                        <span>{provider.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {t(`typeValue.${provider.type}`)}
                          {provider.phone ? ` · ${provider.phone}` : ""}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
              <div className="border-t border-border p-1">
                <button
                  type="button"
                  onClick={() => setMode("custom")}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-primary transition-colors hover:bg-muted"
                >
                  <Plus className="size-4" aria-hidden />
                  {t("addProvider")}
                </button>
              </div>
            </Command>
          ) : (
            <div className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto p-3">
              <p className="text-sm font-medium text-foreground">{t("addProvider")}</p>
              <LabeledInput
                id="custom-provider-name"
                label={t("providerName")}
                placeholder={t("providerNamePlaceholder")}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
              <LabeledInput
                id="custom-provider-phone"
                label={t("providerPhone")}
                placeholder={t("providerPhonePlaceholder")}
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
              />
              <div className="flex flex-col gap-1.5">
                <Select value={customType} onValueChange={(v) => setCustomType(v as ServiceProviderType)}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder={t("providerType")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AI_TECHNICIAN">{t("typeValue.AI_TECHNICIAN")}</SelectItem>
                    <SelectItem value="VETERINARIAN">{t("typeValue.VETERINARIAN")}</SelectItem>
                    <SelectItem value="OTHER">{t("typeValue.OTHER")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={() => setMode("search")}>
                  {t("back")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="flex-1"
                  disabled={!customName.trim() || createCustom.isPending}
                  onClick={submitCustom}
                >
                  {createCustom.isPending ? "…" : t("addItem")}
                </Button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
