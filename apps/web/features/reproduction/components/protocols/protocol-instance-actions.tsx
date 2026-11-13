"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Ban, ListChecks, MoreHorizontal } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/permissions";
import { FormSheet } from "@/components/shared/form-sheet";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@rakhal/ui/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCloseProtocolInstance,
  useRecordProtocolAi,
  useRecordProtocolOutcome,
} from "../../hooks/use-reproduction";
import {
  closeProtocolInstanceSchema,
  recordProtocolAiSchema,
  recordProtocolOutcomeSchema,
  type CloseProtocolInstanceInput,
  type RecordProtocolAiInput,
  type RecordProtocolOutcomeInput,
} from "../../schemas";
import type { ProtocolInstance } from "../../types";
import { DateTimePicker } from "@/components/ui/date-time-picker";

const ACTIVE_STATUSES = ["DRAFT", "SCHEDULED", "IN_PROGRESS"] as const;

/** `DateTimePicker` value (`yyyy-MM-dd'T'HH:mm`, browser-local) for "now" — same default the root
 * Record Breeding dialog uses, so protocol AI and root AI capture date + time the same way. */
function nowDateTimeLocal(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** Row actions for one protocol instance (RAKHAL-214 lifecycle) — record the timed-AI step, record
 * the pregnancy outcome at PD, or cancel/fail the instance. No Figma frame for this module; three
 * small inline `FormSheet`s rather than a full detail page.
 *
 * One **next step** button (the only thing a stockman needs to tap: "Record AI" until the timed AI
 * is in, then "Record outcome" until PD is recorded) plus a "⋯" menu holding the rest — Timeline
 * (always) and the destructive Cancel/Fail (active instances only, permission-gated). Replaces the
 * old row of three equal-weight buttons, where "Cancel/Fail" sat next to the primary action. */
export function ProtocolInstanceActions({
  instance,
  onViewTimeline,
}: {
  instance: ProtocolInstance;
  onViewTimeline: () => void;
}) {
  const t = useTranslations("reproduction.dialogs.protocolInstance");
  const tp = useTranslations("reproduction.protocols");
  const can = useCan();
  const [closeOpen, setCloseOpen] = useState(false);

  const canUpdate = can("reproduction.update");
  const isActive = (ACTIVE_STATUSES as readonly string[]).includes(instance.status);
  const canClose = isActive && canUpdate;

  return (
    <div className="flex items-center gap-1.5">
      <Button size="sm" variant="secondary" onClick={onViewTimeline}>
        <ListChecks className="size-4 mr-1.5" />
        {tp("viewTimeline")}
      </Button>

      {canClose ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-9" aria-label={tp("moreActions")}>
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setCloseOpen(true)} className="text-destructive focus:text-destructive">
              <Ban className="size-4" aria-hidden />
              {t("close")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <CloseInstanceDialog instanceId={instance.id} open={closeOpen} onOpenChange={setCloseOpen} />
    </div>
  );
}

export function RecordAiDialog({
  instanceId,
  open,
  onOpenChange,
}: {
  instanceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("reproduction.dialogs.protocolInstance");
  const recordAi = useRecordProtocolAi();
  const form = useForm<RecordProtocolAiInput>({
    resolver: zodResolver(recordProtocolAiSchema),
    defaultValues: { aiDate: nowDateTimeLocal() },
  });

  async function onSubmit(values: RecordProtocolAiInput) {
    try {
      await recordAi.mutateAsync({
        instanceId,
        input: { ...values, aiDate: values.aiDate ? new Date(values.aiDate).toISOString() : undefined },
      });
      toast.success(t("aiRecordedToast"));
      form.reset({ aiDate: nowDateTimeLocal() });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset({ aiDate: nowDateTimeLocal() });
        onOpenChange(next);
      }}
      title={t("recordAiTitle")}
      onSubmit={form.handleSubmit(onSubmit)}
      pending={recordAi.isPending}
      submitLabel={t("submit")}
    >
      <div className="flex flex-col gap-2">
        <Label>{t("aiDate")}</Label>
        <Controller
          control={form.control}
          name="aiDate"
          render={({ field, fieldState }) => (
            <DateTimePicker
              label={t("aiDate")}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
            />
          )}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("inseminator")}</Label>
        <Input {...form.register("inseminator")} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("notes")}</Label>
        <Textarea {...form.register("notes")} rows={2} />
      </div>
    </FormSheet>
  );
}

export function RecordOutcomeDialog({
  instanceId,
  open,
  onOpenChange,
}: {
  instanceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("reproduction.dialogs.protocolInstance");
  const recordOutcome = useRecordProtocolOutcome();
  const form = useForm<RecordProtocolOutcomeInput>({
    resolver: zodResolver(recordProtocolOutcomeSchema),
    defaultValues: { outcome: "PREGNANT" },
  });

  async function onSubmit(values: RecordProtocolOutcomeInput) {
    try {
      await recordOutcome.mutateAsync({ instanceId, input: values });
      toast.success(t("outcomeRecordedToast"));
      form.reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset();
        onOpenChange(next);
      }}
      title={t("recordOutcomeTitle")}
      onSubmit={form.handleSubmit(onSubmit)}
      pending={recordOutcome.isPending}
      submitLabel={t("submit")}
    >
      <div className="flex flex-col gap-2">
        <Label>{t("outcome")}</Label>
        <Controller
          control={form.control}
          name="outcome"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PREGNANT">{t("outcomeValue.PREGNANT")}</SelectItem>
                <SelectItem value="OPEN">{t("outcomeValue.OPEN")}</SelectItem>
                <SelectItem value="PREGNANCY_LOSS">{t("outcomeValue.PREGNANCY_LOSS")}</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("notes")}</Label>
        <Textarea {...form.register("notes")} rows={2} />
      </div>
    </FormSheet>
  );
}

function CloseInstanceDialog({
  instanceId,
  open,
  onOpenChange,
}: {
  instanceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("reproduction.dialogs.protocolInstance");
  const closeInstance = useCloseProtocolInstance();
  const form = useForm<CloseProtocolInstanceInput>({
    resolver: zodResolver(closeProtocolInstanceSchema),
    defaultValues: { status: "CANCELLED" },
  });

  async function onSubmit(values: CloseProtocolInstanceInput) {
    try {
      await closeInstance.mutateAsync({ instanceId, input: values });
      toast.success(t("closedToast"));
      form.reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset();
        onOpenChange(next);
      }}
      title={t("closeTitle")}
      onSubmit={form.handleSubmit(onSubmit)}
      pending={closeInstance.isPending}
      submitLabel={t("submit")}
    >
      <div className="flex flex-col gap-2">
        <Label>{t("closeStatus")}</Label>
        <Controller
          control={form.control}
          name="status"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CANCELLED">{t("closeStatusValue.CANCELLED")}</SelectItem>
                <SelectItem value="FAILED">{t("closeStatusValue.FAILED")}</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("reason")}</Label>
        <Textarea {...form.register("reason")} rows={2} />
      </div>
    </FormSheet>
  );
}
