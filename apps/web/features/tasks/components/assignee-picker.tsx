"use client"; // popover open state + type-ahead filter

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@rakhal/ui/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@rakhal/ui/ui/command";
import { useTaskAssignees } from "../hooks/use-tasks";

export interface AssigneePickerProps {
  value?: string;
  onValueChange: (userId: string, name: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/** "Assign to" (Figma "Type name to assign", 1039:48550) — type-ahead over `GET /settings/team`'s
 * active members. Same `Popover`+`Command` shape as `CattlePicker`, but rendered in the app's
 * floating-label field chrome (`LabeledSelectTrigger`) to match this modal's other inputs, since the
 * mock's "Assign to" box is visually identical to its other bordered fields, not a plain button. */
export function AssigneePicker({ value, onValueChange, placeholder, disabled, className }: AssigneePickerProps) {
  const t = useTranslations("tasks.createSheet");
  const [open, setOpen] = useState(false);
  const { data: options = [], isLoading } = useTaskAssignees();
  const selected = options.find((o) => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "relative flex h-11 w-full items-center justify-between rounded-xl border border-input bg-card px-4 py-2 text-left shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className={cn("truncate text-sm", selected ? "text-foreground" : "text-muted-foreground")}>
            {selected ? selected.name : (placeholder ?? t("assignPlaceholder"))}
          </span>
          <span className="absolute -top-2.5 left-3 rounded bg-card px-1 text-xs text-foreground">{t("assignTo")}</span>
          <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder={t("assignSearchPlaceholder")} />
          <CommandList>
            <CommandEmpty>{isLoading ? t("loadingAssignees") : t("noAssignees")}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.name}
                  onSelect={() => {
                    onValueChange(option.id, option.name);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 size-4", option.id === value ? "opacity-100" : "opacity-0")} aria-hidden />
                  {option.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
