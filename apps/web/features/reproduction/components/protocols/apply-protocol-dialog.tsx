"use client";

import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { X } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { FormDialog } from "@/components/shared/form-dialog";
import { CattleMultiPicker, type CattleOption } from "@/components/shared/cattle-picker";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useApplyProtocol, useProtocolInstance, useProtocols } from "../../hooks/use-reproduction";
import { applyProtocolSchema, type ApplyProtocolInput } from "../../schemas";
import { ProtocolDetailSheet } from "./protocol-detail-sheet";
import { ProtocolInstanceTimeline } from "./protocol-instance-timeline";

/** "Apply Protocol" (RAKHAL-214, PRD §9.8) — no Figma frame for this module. Mirrors
 * `ApplyProtocolDto` exactly. Cattle selection uses `CattleMultiPicker` (RAKHAL-214 follow-up,
 * user request): a single popover that stays open across picks and toggles a checked row off on
 * re-select, instead of the old pick-one→close→reopen loop; the removable chip list below stays as
 * a compact confirmation of the current selection. On success the dialog closes and the timeline
 * sheet for the first created instance auto-opens, so the farmer immediately sees the day-by-day
 * schedule they just committed to instead of only a toast. */
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
  const [appliedInstanceId, setAppliedInstanceId] = useState<string | null>(null);
  const appliedInstance = useProtocolInstance(appliedInstanceId ?? undefined);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedProtocolId, setSelectedProtocolId] = useState("");
  const protocolOptions = useMemo(() => protocols.data?.pages.flatMap((p) => p.items) ?? [], [protocols.data]);

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
      setSelectedProtocolId("");
    }
  }

  function updateSelectedCattle(next: CattleOption[]) {
    setSelectedCattle(next);
    form.setValue(
      "cattleIds",
      next.map((c) => c.id),
      { shouldValidate: true },
    );
  }

  function removeCattle(id: string) {
    updateSelectedCattle(selectedCattle.filter((c) => c.id !== id));
  }

  async function onSubmit(values: ApplyProtocolInput) {
    try {
      const result = await applyProtocol.mutateAsync({
        ...values,
        startDate: values.startDate || undefined,
      });
      toast.success(t("appliedToast", { count: result.applied }));
      onOpenChange(false);
      setAppliedInstanceId(result.instance_ids[0] ?? null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <>
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
              <div className="flex items-center gap-2">
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    setSelectedProtocolId(value);
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t("protocolPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {protocolOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({t("stepCount", { count: p.step_count })})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={!field.value}
                  onClick={() => setDetailOpen(true)}
                >
                  {t("viewDetails")}
                </Button>
              </div>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>{t("cattle")}</Label>
          <CattleMultiPicker
            value={selectedCattle}
            onValueChange={updateSelectedCattle}
            placeholder={t("cattlePlaceholder")}
            filters={{ gender: "FEMALE", reproductiveStatus: "OPEN" }}
          />
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

      <ProtocolInstanceTimeline
        instance={appliedInstance.data ?? null}
        open={appliedInstanceId !== null && Boolean(appliedInstance.data)}
        onOpenChange={(next) => {
          if (!next) setAppliedInstanceId(null);
        }}
      />
      <ProtocolDetailSheet
        protocol={protocolOptions.find((p) => p.id === selectedProtocolId) ?? null}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        startDate={form.watch("startDate")}
      />
    </>
  );
}
