"use client";

import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@rakhal/ui/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfigureOnboarding } from "../hooks/use-configure-onboarding";
import { configureOnboardingFormSchema, type ConfigureOnboardingFormInput } from "../schemas";

const SESSIONS = ["morning", "noon", "evening", "night"] as const;

/** Wizard Step 2 (PRD §5.1 Step 3) — sheds + milking sessions + milk unit. All fields are optional
 * server-side (`ConfigureOnboardingDto`), so "Skip" advances without calling the API at all. */
export function ConfigureStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const t = useTranslations("onboarding.wizard.configure");
  const configure = useConfigureOnboarding();
  const form = useForm<ConfigureOnboardingFormInput>({
    resolver: zodResolver(configureOnboardingFormSchema),
    defaultValues: {
      sheds: [],
      active_sessions: ["morning", "evening"],
      milk_unit: "litres",
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "sheds" });

  async function onSubmit(values: ConfigureOnboardingFormInput) {
    try {
      await configure.mutateAsync({
        ...values,
        sheds: values.sheds
          .filter((s) => s.name.trim().length > 0)
          .map((s) => ({
            name: s.name,
            purpose: s.purpose,
            capacity: s.capacity && s.capacity.trim() !== "" ? Number(s.capacity) : undefined,
          })),
      });
      toast.success(t("savedToast"));
      onNext();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-3">
        <Label>{t("shedsLabel")}</Label>
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <Input placeholder={t("shedNamePlaceholder")} {...form.register(`sheds.${index}.name`)} />
            <Input
              type="number"
              min={1}
              placeholder={t("shedCapacityPlaceholder")}
              className="w-32"
              {...form.register(`sheds.${index}.capacity`)}
            />
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label={t("removeShed")}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => append({ name: "", capacity: "", purpose: undefined })}
        >
          <Plus className="size-4" aria-hidden />
          {t("addShed")}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <Label>{t("sessionsLabel")}</Label>
        <Controller
          control={form.control}
          name="active_sessions"
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SESSIONS.map((session) => (
                <label key={session} className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox
                    checked={field.value.includes(session)}
                    onCheckedChange={(checked) =>
                      field.onChange(
                        checked === true
                          ? [...field.value, session]
                          : field.value.filter((s) => s !== session),
                      )
                    }
                  />
                  {t(`sessions.${session}`)}
                </label>
              ))}
            </div>
          )}
        />
        {form.formState.errors.active_sessions ? (
          <p role="alert" className="text-sm text-destructive">
            {t("sessionRequired")}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("milkUnitLabel")}</Label>
        <Controller
          control={form.control}
          name="milk_unit"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="litres">{t("milkUnit.litres")}</SelectItem>
                <SelectItem value="kg">{t("milkUnit.kg")}</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onSkip}>
          {t("skip")}
        </Button>
        <Button type="submit" disabled={configure.isPending}>
          {configure.isPending ? t("saving") : t("continue")}
        </Button>
      </div>
    </form>
  );
}
