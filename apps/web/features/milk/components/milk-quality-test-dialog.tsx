"use client"; // form state + mutation + a scoped lactation lookup query

import { todayLocalIso } from "@/lib/local-date";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { qk } from "@/lib/query/keys";
import { FormSheet } from "@/components/shared/form-sheet";
import { Label } from "@rakhal/ui/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { reproductionApi } from "@/features/reproduction/api";
import { useCreateMilkQualityTest } from "../hooks/use-milk-quality-tests";
import { createMilkQualityTestSchema, type CreateMilkQualityTestFormInput } from "../schemas";
import { MILK_QUALITY_TEST_SOURCES } from "../types";
import { DatePicker } from "@/components/ui/date-picker";

const DEFAULT_VALUES: CreateMilkQualityTestFormInput = {
  cattleId: "",
  lactationId: "",
  sampleDate: todayLocalIso(),
  fatPct: undefined as unknown as number,
  proteinPct: undefined as unknown as number,
  lactosePct: undefined,
  somaticCellCount: undefined,
  milkUreaNitrogen: undefined,
  source: "MANUAL",
  notes: "",
};

/**
 * `POST /milk/quality-tests` (RAKHAL-282/293-F) — `milk.quality.create`-gated. The DTO requires a
 * `lactationId` the backend validates belongs to this cow (`MilkQualityService.assertLactationBelongsToCattle`),
 * but no endpoint returns a cow's "current" lactation id directly (`GET /cattle/:id/overview` and
 * `/reproduction-summary` both omit it — confirmed by reading `cattle-detail.service.ts` /
 * `reproduction.service.ts#summary`). Reusing the already-built `GET /reproduction/lactations?cattleId=`
 * (`reproductionApi.lactations`, `reproduction.read`-gated) to list this cow's lactations and default
 * to the most recent `ACTIVE` one — flagged as a real API-shape gap in `docs/PROJECT_PROGRESS.md`
 * rather than guessed.
 */
export function MilkQualityTestDialog({
  cattleId,
  open,
  onOpenChange,
}: {
  cattleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("cattle.detail.performance.qualityTests.dialog");
  const createTest = useCreateMilkQualityTest(cattleId);

  const lactationsQuery = useQuery({
    queryKey: qk.reproduction.lactations(cattleId),
    queryFn: () => reproductionApi.lactations(cattleId),
    enabled: open && !!cattleId,
    staleTime: 60_000,
  });
  const lactations = useMemo(() => lactationsQuery.data?.items ?? [], [lactationsQuery.data]);
  const activeLactation = useMemo(() => lactations.find((l) => l.status === "ACTIVE"), [lactations]);

  const form = useForm<CreateMilkQualityTestFormInput>({
    resolver: zodResolver(createMilkQualityTestSchema),
    defaultValues: { ...DEFAULT_VALUES, cattleId },
  });

  // Default the lactation select to the cow's active lactation once it's loaded.
  useEffect(() => {
    if (open && activeLactation && !form.getValues("lactationId")) {
      form.setValue("lactationId", activeLactation.id);
    }
  }, [open, activeLactation, form]);

  async function onSubmit(values: CreateMilkQualityTestFormInput) {
    try {
      await createTest.mutateAsync({ ...values, cattleId });
      toast.success(t("recordedToast"));
      form.reset({ ...DEFAULT_VALUES, cattleId, lactationId: activeLactation?.id ?? "" });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      onSubmit={form.handleSubmit(onSubmit)}
      pending={createTest.isPending}
      submitLabel={t("save")}
      cancelLabel={t("cancel")}
    >
      <div className="flex flex-col gap-1.5">
        <Label>{t("lactation")}</Label>
        <Controller
          control={form.control}
          name="lactationId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={lactationsQuery.isLoading}>
              <SelectTrigger aria-label={t("lactation")}>
                <SelectValue placeholder={t("lactationPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {lactations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {t("lactationOption", { number: l.lactationNumber, status: l.status })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {!lactationsQuery.isLoading && lactations.length === 0 ? (
          <p className="text-xs text-destructive">{t("noLactations")}</p>
        ) : null}
        {form.formState.errors.lactationId ? (
          <p className="text-xs text-destructive">{form.formState.errors.lactationId.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quality-test-sample-date">{t("sampleDate")}</Label>
        <Controller
          control={form.control}
          name="sampleDate"
          render={({ field, fieldState }) => (
            <DatePicker
              id="quality-test-sample-date"
              label={t("sampleDate")}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
            />
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quality-test-fat">{t("fatPct")}</Label>
          <Input
            id="quality-test-fat"
            type="number"
            step="0.01"
            min={0}
            max={100}
            {...form.register("fatPct", { valueAsNumber: true })}
          />
          {form.formState.errors.fatPct ? (
            <p className="text-xs text-destructive">{form.formState.errors.fatPct.message}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quality-test-protein">{t("proteinPct")}</Label>
          <Input
            id="quality-test-protein"
            type="number"
            step="0.01"
            min={0}
            max={100}
            {...form.register("proteinPct", { valueAsNumber: true })}
          />
          {form.formState.errors.proteinPct ? (
            <p className="text-xs text-destructive">{form.formState.errors.proteinPct.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quality-test-lactose">{t("lactosePct")}</Label>
          <Input
            id="quality-test-lactose"
            type="number"
            step="0.01"
            min={0}
            max={100}
            {...form.register("lactosePct", { valueAsNumber: true })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quality-test-scc">{t("somaticCellCount")}</Label>
          <Input
            id="quality-test-scc"
            type="number"
            step="1"
            min={0}
            {...form.register("somaticCellCount", { valueAsNumber: true })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quality-test-mun">{t("milkUreaNitrogen")}</Label>
        <Input
          id="quality-test-mun"
          type="number"
          step="0.01"
          min={0}
          {...form.register("milkUreaNitrogen", { valueAsNumber: true })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t("source")}</Label>
        <Controller
          control={form.control}
          name="source"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger aria-label={t("source")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MILK_QUALITY_TEST_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`sourceOptions.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quality-test-notes">{t("notes")}</Label>
        <Textarea id="quality-test-notes" rows={2} {...form.register("notes")} />
      </div>
    </FormSheet>
  );
}
