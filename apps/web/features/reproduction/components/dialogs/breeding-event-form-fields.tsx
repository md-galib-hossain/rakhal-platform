"use client";

import { Controller, type UseFormReturn } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { apiFetchPage } from "@/lib/api/client";
import { CattlePicker } from "@/components/shared/cattle-picker";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ServiceProviderPicker } from "@/features/settings/components/service-provider-picker";
import { AccountPicker } from "@/features/finance/components/account-picker";
import { SemenBatchPicker } from "@/features/inventory/components/semen-batch-picker";
import { useSemenBatches } from "@/features/inventory/hooks/use-inventory";
import type { CreateBreedingEventInput } from "../../schemas";
import { DateTimePicker } from "@/components/ui/date-time-picker";

const BREEDING_METHODS = ["AI", "NATURAL", "EMBRYO_TRANSFER"] as const;
const SEMEN_SOURCES = ["FARM_INVENTORY", "TECHNICIAN_SUPPLIED", "EXTERNAL"] as const;
const SEMEN_TYPES = ["CONVENTIONAL", "SEX_SORTED"] as const;
const TARGET_SEXES = ["FEMALE", "MALE"] as const;

/** RAKHAL-393 (closes RD-066): shared financial-account picker — AI-from-inventory cost, manual
 * serviceCost, and NATURAL/EMBRYO_TRANSFER's own optional cost all funnel through this same control.
 * Replaces the old `paymentMethod` `Select` (which the backend resolved to "the farm's oldest active
 * account of that type") with the real `AccountPicker` every other V2 money-movement form uses, so
 * the farmer picks the exact account a breeding cost posts from. */
function AccountField({ form }: { form: UseFormReturn<CreateBreedingEventInput> }) {
  // One account per farm: nothing to show, the invisible picker just keeps the farm's account in the form.
  return <Controller control={form.control} name="financialAccountId" render={({ field }) => <AccountPicker value={field.value} onChange={field.onChange} />} />;
}

/** Pure field markup for a breeding-event form, extracted out of `breeding-event-dialog.tsx` so
 * `breeding-event-step.tsx` (Edit Animal's wizard step) can render the identical fields without
 * duplicating them — the dialog and the step each own their own `useForm`/mutation/submit, this
 * component only needs the shared `form` instance. */
export function BreedingEventFormFields({ form }: { form: UseFormReturn<CreateBreedingEventInput> }) {
  const t = useTranslations("reproduction.dialogs.breeding");
  const breedingMethod = form.watch("breedingMethod");
  const semenSource = form.watch("semenSource");
  const semenBatches = useSemenBatches({ enabled: breedingMethod === "AI" && semenSource === "FARM_INVENTORY" });

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label>{t("cattle")}</Label>
        <Controller
          control={form.control}
          name="cattleId"
          render={({ field }) => (
            <CattlePicker value={field.value} onValueChange={(id) => field.onChange(id)} filters={{ gender: "FEMALE" }} />
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label>{t("breedingDate")}</Label>
          <Controller
            control={form.control}
            name="breedingDate"
            render={({ field, fieldState }) => (
              <DateTimePicker
                label={t("breedingDate")}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t("breedingMethod")}</Label>
          <Controller
            control={form.control}
            name="breedingMethod"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BREEDING_METHODS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {t(`breedingMethodValue.${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      {breedingMethod === "AI" ? (
        <>
          <div className="flex flex-col gap-2">
            <Label>{t("semenSource")}</Label>
            <Controller
              control={form.control}
              name="semenSource"
              render={({ field }) => (
                <Select
                  value={field.value ?? "FARM_INVENTORY"}
                  onValueChange={(v) => {
                    field.onChange(v);
                    // Switching source clears the fields that only apply to the old one — mirrors
                    // the backend's own auto-clear on edit (reproduction-edit.service.ts).
                    if (v !== "FARM_INVENTORY") form.setValue("semenBatchId", undefined);
                    if (v === "FARM_INVENTORY") {
                      form.setValue("serviceProviderId", undefined);
                      form.setValue("sireNameOrCode", undefined);
                      form.setValue("sireBreed", undefined);
                      form.setValue("semenType", undefined);
                      form.setValue("targetSex", undefined);
                      form.setValue("strawBatchCode", undefined);
                      form.setValue("semenCompany", undefined);
                      form.setValue("serviceCost", undefined);
                    }
                    if (v !== "TECHNICIAN_SUPPLIED") form.setValue("serviceProviderId", undefined);
                    if (v === "TECHNICIAN_SUPPLIED") form.setValue("inseminator", undefined);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEMEN_SOURCES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {t(`semenSourceValue.${v}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {(semenSource ?? "FARM_INVENTORY") === "FARM_INVENTORY" ? (
            <div className="flex flex-col gap-2">
              <Label>{t("semenBatch")}</Label>
              <Controller
                control={form.control}
                name="semenBatchId"
                render={({ field }) => (
                  <SemenBatchPicker
                    value={field.value}
                    onChange={field.onChange}
                    error={form.formState.errors.semenBatchId?.message}
                  />
                )}
              />
              {(() => {
                const selectedBatch = (semenBatches.data ?? []).find(
                  (b) => b.id === form.watch("semenBatchId"),
                );
                if (!selectedBatch) return null;
                return (
                  <div className="flex flex-col gap-1">
                    {selectedBatch.semenType ? (
                      <p className="text-xs text-muted-foreground">
                        {t(`semenTypeValue.${selectedBatch.semenType}`)}
                        {selectedBatch.semenType === "SEX_SORTED" && selectedBatch.targetSex
                          ? ` — ${t(`targetSexValue.${selectedBatch.targetSex}`)}`
                          : ""}
                      </p>
                    ) : null}
                    {/* Cost comes from the batch, resolved server-side as inventory consumption for the animal. */}
                    <p className="text-xs text-muted-foreground">
                      {t("costFromBatch", { cost: selectedBatch.costPerUnit ?? 0 })}
                    </p>
                  </div>
                );
              })()}
            </div>
          ) : (
            <>
              {semenSource === "TECHNICIAN_SUPPLIED" ? (
                <div className="flex flex-col gap-2">
                  <Label>{t("serviceProvider")}</Label>
                  <Controller
                    control={form.control}
                    name="serviceProviderId"
                    render={({ field }) => (
                      <ServiceProviderPicker
                        value={field.value}
                        onChange={field.onChange}
                        placeholder={t("serviceProviderPlaceholder")}
                      />
                    )}
                  />
                </div>
              ) : null}

              {/* Progressive-optional — a farmer may only know "the technician brought Holstein
                  semen" and nothing more; none of these block saving. */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label>{t("sireNameOrCode")}</Label>
                  <Input {...form.register("sireNameOrCode")} placeholder={t("sireNameOrCodePlaceholder")} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{t("sireBreed")}</Label>
                  <Input {...form.register("sireBreed")} placeholder={t("sireBreedPlaceholder")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label>{t("semenType")}</Label>
                  <Controller
                    control={form.control}
                    name="semenType"
                    render={({ field }) => (
                      <Select
                        value={field.value ?? ""}
                        onValueChange={(v) => {
                          field.onChange(v);
                          if (v !== "SEX_SORTED") form.setValue("targetSex", undefined);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("semenTypePlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {SEMEN_TYPES.map((v) => (
                            <SelectItem key={v} value={v}>
                              {t(`semenTypeValue.${v}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>
                    {t("serviceCost")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    {...form.register("serviceCost", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
                    placeholder={t("serviceCostPlaceholder")}
                  />
                  {form.formState.errors.serviceCost ? (
                    <p className="text-xs text-destructive">{form.formState.errors.serviceCost.message}</p>
                  ) : null}
                </div>
              </div>
              <AccountField form={form} />
              {form.watch("semenType") === "SEX_SORTED" ? (
                <div className="flex flex-col gap-2">
                  <Label>{t("targetSex")}</Label>
                  <Controller
                    control={form.control}
                    name="targetSex"
                    render={({ field }) => (
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("targetSexPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {TARGET_SEXES.map((v) => (
                            <SelectItem key={v} value={v}>
                              {t(`targetSexValue.${v}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              ) : null}
            </>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <Label>{t("bull")}</Label>
            <Controller
              control={form.control}
              name="bullId"
              render={({ field }) => (
                <CattlePicker value={field.value} onValueChange={(id) => field.onChange(id)} filters={{ gender: "MALE" }} />
              )}
            />
          </div>
          {/* RAKHAL-330: not every natural/embryo-transfer breeding costs money (e.g. the farm's own
              bull) — cost stays optional here, but paying a real amount still needs a payment source. */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>{t("serviceCost")}</Label>
              <Input
                type="number"
                min={0}
                {...form.register("serviceCost", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
                placeholder={t("serviceCostPlaceholder")}
              />
              {form.formState.errors.serviceCost ? (
                <p className="text-xs text-destructive">{form.formState.errors.serviceCost.message}</p>
              ) : null}
            </div>
            <AccountField form={form} />
          </div>
        </>
      )}

      {semenSource !== "TECHNICIAN_SUPPLIED" ? (
        <div className="flex flex-col gap-2">
          <Label>{t("inseminator")}</Label>
          <Input {...form.register("inseminator")} placeholder={t("inseminatorPlaceholder")} />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label>{t("notes")}</Label>
        <Textarea {...form.register("notes")} placeholder={t("notesPlaceholder")} rows={2} />
      </div>
    </>
  );
}
