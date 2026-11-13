"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@rakhal/ui/ui/button";
import { Input } from "@rakhal/ui/ui/input";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";

const CREATE_NEW = "__creatable_select_create_new__";

export interface CreatableSelectOption {
  id: string;
  name: string;
}

export interface CreatableSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  options: CreatableSelectOption[];
  /** A `SelectTrigger`/`LabeledSelectTrigger` element — this component owns the `Select` wrapper
   * and `SelectContent`, callers only supply the trigger chrome so both the stacked-label
   * (`LabeledSelectTrigger`) and plain (`SelectTrigger`+`SelectValue`) styles can reuse this. */
  trigger: React.ReactNode;
  createLabel: string;
  namePlaceholder: string;
  onCreate: (name: string) => Promise<CreatableSelectOption>;
  createErrorMessage: string;
  /** Extra `SelectItem`s rendered before `options` (e.g. an "unassigned" sentinel). */
  extraItems?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * Select with a trailing "+ Create new…" item. Picking it expands an inline name-entry row below
 * the trigger (autofocus, Enter to save, Escape to cancel) instead of opening a dialog — the
 * created option is auto-selected on success. Callers are responsible for invalidating whatever
 * query keys their `onCreate` mutation's list depends on so every other picker for the same
 * resource (e.g. shed appears in both the Cattle and Settings features) stays in sync.
 */
export function CreatableSelect({
  value,
  onValueChange,
  options,
  trigger,
  createLabel,
  namePlaceholder,
  onCreate,
  createErrorMessage,
  extraItems,
  disabled,
  className,
}: CreatableSelectProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) nameInputRef.current?.focus();
  }, [creating]);

  function cancel() {
    setCreating(false);
    setName("");
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const created = await onCreate(trimmed);
      onValueChange(created.id);
      cancel();
    } catch {
      toast.error(createErrorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(v) => {
          if (v === CREATE_NEW) {
            setCreating(true);
            return;
          }
          onValueChange(v);
        }}
      >
        {trigger}
        <SelectContent>
          {extraItems}
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
          <SelectItem value={CREATE_NEW} className="text-primary">
            <span className="flex items-center gap-1.5">
              <Plus className="size-3.5" aria-hidden />
              {createLabel}
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
      {creating ? (
        <div className="flex items-center gap-2 rounded-xl border border-input bg-muted/40 p-2 shadow-xs">
          <Input
            ref={nameInputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={namePlaceholder}
            disabled={submitting}
            className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void save();
              }
              if (e.key === "Escape") cancel();
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 shrink-0 text-primary"
            disabled={!name.trim() || submitting}
            onClick={() => void save()}
            aria-label={createLabel}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Check className="size-4" aria-hidden />
            )}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 shrink-0 text-muted-foreground"
            disabled={submitting}
            onClick={cancel}
            aria-label="Cancel"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
