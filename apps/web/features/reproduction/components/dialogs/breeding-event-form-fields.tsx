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
import type { CreateBreedingEventInput } from "../../schemas";

const BREEDING_METHODS = ["AI", "NATURAL", "EMBRYO_TRANSFER"] as const;
const SEMEN_SOURCES = ["FARM_INVENTORY", "TECHNICIAN_SUPPLIED", "EXTERNAL"] as const;
const SEMEN_TYPES = ["CONVENTIONAL", "SEX_SORTED"] as const;
const TARGET_SEXES = ["FEMALE", "MALE"] as const;

interface SemenBatchOption {
  id: string;
  name: string;
  batchCode: string | null;
  breed: string | null;
  strawQuantity: number;
  semenType: "CONVENTIONAL" | "SEX_SORTED" | null;
  targetSex: "FEMALE" | "MALE" | null;
}

/** `GET /inventory/semen/batches` (`inventory.read`-gated) — only batches with straws left, so an
 * AI event can't pick an empty one and 400 on the backend's `decrementStraw`. */
function useSemenBatches(enabled: boolean) {
  return useQuery({
    queryKey: ["semen-batches", "picker"],
    queryFn: () => apiFetchPage<SemenBatchOption>("/inventory/semen/batches", { searchParams: { limit: 100 } }),
    enabled,
    staleTime: 30_000,
    select: (page) => page.items.filter((b) => b.strawQuantity > 0),
  });
}

/** Pure field markup for a breeding-event form, extracted out of `breeding-event-dialog.tsx` so
 * `breeding-event-step.tsx` (Edit Animal's wizard step) can render the identical fields without
 * duplicating them — the dialog and the step each own their own `useForm`/mutation/submit, this
 * component only needs the shared `form` instance. */
export function BreedingEventFormFields({ form }: { form: UseFormReturn<CreateBreedingEventInput> }) {
  const t = useTranslations("reproduction.dialogs.breeding");
  const breedingMethod = form.watch("breedingMethod");
  const semenSource = form.watch("semenSource");
  const semenBatches = useSemenBatches(breedingMethod === "AI" && semenSource === "FARM_INVENTORY");

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
          <Input type="datetime-local" {...form.register("breedingDate")} />
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
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("semenBatchPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(semenBatches.data ?? []).map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name} {b.batchCode ? `(${b.batchCode})` : ""} — {t("strawsLeft", { count: b.strawQuantity })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {(() => {
                const selectedBatch = (semenBatches.data ?? []).find(
                  (b) => b.id === form.watch("semenBatchId"),
                );
                if (!selectedBatch?.semenType) return null;
                return (
                  <p className="text-xs text-muted-foreground">
                    {t(`semenTypeValue.${selectedBatch.semenType}`)}
                    {selectedBatch.semenType === "SEX_SORTED" && selectedBatch.targetSex
                      ? ` — ${t(`targetSexValue.${selectedBatch.targetSex}`)}`
                      : ""}
                  </p>
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
                  <Label>{t("serviceCost")}</Label>
                  <Input
                    type="number"
                    min={0}
                    {...form.register("serviceCost", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
                    placeholder={t("serviceCostPlaceholder")}
                  />
                </div>
              </div>
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
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label>{t("strawBatchCode")}</Label>
                  <Input {...form.register("strawBatchCode")} placeholder={t("strawBatchCodePlaceholder")} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{t("semenCompany")}</Label>
                  <Input {...form.register("semenCompany")} placeholder={t("semenCompanyPlaceholder")} />
                </div>
              </div>
            </>
          )}
        </>
      ) : (
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
      )}

      <div className="flex flex-col gap-2">
        <Label>{t("inseminator")}</Label>
        <Input {...form.register("inseminator")} placeholder={t("inseminatorPlaceholder")} />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("notes")}</Label>
        <Textarea {...form.register("notes")} placeholder={t("notesPlaceholder")} rows={2} />
      </div>
    </>
  );
}
