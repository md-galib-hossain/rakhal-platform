"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { FormDialog } from "@/components/shared/form-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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

const ACTIVE_STATUSES = ["DRAFT", "SCHEDULED", "IN_PROGRESS"] as const;

/** Row actions for one protocol instance (RAKHAL-214 lifecycle) — record the timed-AI step, record
 * the pregnancy outcome at PD, or cancel/fail the instance. No Figma frame for this module; three
 * small inline `FormDialog`s rather than a full detail page, matching the compactness of the rest
 * of this protocols panel. */
export function ProtocolInstanceActions({ instance }: { instance: ProtocolInstance }) {
  const t = useTranslations("reproduction.dialogs.protocolInstance");
  const [aiOpen, setAiOpen] = useState(false);
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  const canRecordAi = (ACTIVE_STATUSES as readonly string[]).includes(instance.status);
  const canRecordOutcome = !!instance.ai_completed_at;
  const canClose = instance.status !== "COMPLETED";

  return (
    <div className="flex items-center gap-1.5">
      {canRecordAi ? (
        <Button size="sm" variant="outline" onClick={() => setAiOpen(true)}>
          {t("recordAi")}
        </Button>
      ) : null}
      {canRecordOutcome ? (
        <Button size="sm" variant="outline" onClick={() => setOutcomeOpen(true)}>
          {t("recordOutcome")}
        </Button>
      ) : null}
      {canClose ? (
        <Button size="sm" variant="ghost" onClick={() => setCloseOpen(true)}>
          {t("close")}
        </Button>
      ) : null}

      <RecordAiDialog instanceId={instance.id} open={aiOpen} onOpenChange={setAiOpen} />
      <RecordOutcomeDialog instanceId={instance.id} open={outcomeOpen} onOpenChange={setOutcomeOpen} />
      <CloseInstanceDialog instanceId={instance.id} open={closeOpen} onOpenChange={setCloseOpen} />
    </div>
  );
}

function RecordAiDialog({
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
  const form = useForm<RecordProtocolAiInput>({ resolver: zodResolver(recordProtocolAiSchema), defaultValues: {} });

  async function onSubmit(values: RecordProtocolAiInput) {
    try {
      await recordAi.mutateAsync({ instanceId, input: values });
      toast.success(t("aiRecordedToast"));
      form.reset();
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
      title={t("recordAiTitle")}
      onSubmit={form.handleSubmit(onSubmit)}
      pending={recordAi.isPending}
      submitLabel={t("submit")}
    >
      <div className="flex flex-col gap-2">
        <Label>{t("aiDate")}</Label>
        <Input type="date" {...form.register("aiDate")} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("inseminator")}</Label>
        <Input {...form.register("inseminator")} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("notes")}</Label>
        <Textarea {...form.register("notes")} rows={2} />
      </div>
    </FormDialog>
  );
}

function RecordOutcomeDialog({
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
    <FormDialog
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
    </FormDialog>
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
    <FormDialog
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
    </FormDialog>
  );
}
