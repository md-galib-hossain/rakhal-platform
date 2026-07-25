"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { X } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { FormDialog } from "@/components/shared/form-dialog";
import { CattlePicker, type CattleOption } from "@/components/shared/cattle-picker";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApplyProtocol, useProtocols } from "../../hooks/use-reproduction";
import { applyProtocolSchema, type ApplyProtocolInput } from "../../schemas";

/** "Apply Protocol" (RAKHAL-214, PRD §9.8) — no Figma frame for this module. `CattlePicker` only
 * selects one cow at a time, so multi-cow selection here is an additive chip list (pick → add →
 * remove), same as the Feed Formulator's group-assign picker pattern elsewhere in this app. Mirrors
 * `ApplyProtocolDto` exactly. */
export function ApplyProtocolDialog({
  open,
  onOpenChange,
  defaultCattleId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCattleId?: string;
}) {
  const t = useTranslations("reproduction.dialogs.applyProtocol");
  const protocols = useProtocols();
  const applyProtocol = useApplyProtocol();
  const [selectedCattle, setSelectedCattle] = useState<CattleOption[]>([]);

  const form = useForm<ApplyProtocolInput>({
    resolver: zodResolver(applyProtocolSchema),
    defaultValues: { protocolId: "", cattleIds: defaultCattleId ? [defaultCattleId] : [] },
  });

  // Reset when the dialog transitions closed→open — done during render via a synced-state
  // comparison (not a ref, not an effect), same pattern as FilterBar's SearchInput
  // (https://react.dev/learn/you-might-not-need-an-effect) — this repo's React Compiler forbids
  // ref reads/writes during render.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      form.reset({ protocolId: "", cattleIds: defaultCattleId ? [defaultCattleId] : [] });
      setSelectedCattle([]);
    }
  }

  function addCattle(option: CattleOption) {
    if (selectedCattle.some((c) => c.id === option.id)) return;
    const next = [...selectedCattle, option];
    setSelectedCattle(next);
    form.setValue(
      "cattleIds",
      next.map((c) => c.id),
      { shouldValidate: true },
    );
  }

  function removeCattle(id: string) {
    const next = selectedCattle.filter((c) => c.id !== id);
    setSelectedCattle(next);
    form.setValue(
      "cattleIds",
      next.map((c) => c.id),
      { shouldValidate: true },
    );
  }

  async function onSubmit(values: ApplyProtocolInput) {
    try {
      const result = await applyProtocol.mutateAsync({
        ...values,
        startDate: values.startDate || undefined,
      });
      toast.success(t("appliedToast", { count: result.applied }));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset();
        onOpenChange(next);
      }}
      title={t("title")}
      onSubmit={form.handleSubmit(onSubmit)}
      pending={applyProtocol.isPending}
      submitLabel={t("submit")}
    >
      <div className="flex flex-col gap-2">
        <Label>{t("protocol")}</Label>
        <Controller
          control={form.control}
          name="protocolId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("protocolPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {(protocols.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({t("stepCount", { count: p.step_count })})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("cattle")}</Label>
        <CattlePicker onValueChange={(_id, option) => addCattle(option)} filters={{ gender: "FEMALE" }} />
        {selectedCattle.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selectedCattle.map((c) => (
              <span
                key={c.id}
                className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-foreground"
              >
                {c.tagNumber}
                {c.name ? ` — ${c.name}` : ""}
                <button type="button" onClick={() => removeCattle(c.id)} aria-label={t("removeCow")}>
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        {form.formState.errors.cattleIds ? (
          <p className="text-xs text-destructive">{form.formState.errors.cattleIds.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("startDate")}</Label>
        <Input type="date" {...form.register("startDate")} />
      </div>
    </FormDialog>
  );
}
