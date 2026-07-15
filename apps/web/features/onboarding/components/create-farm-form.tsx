"use client"; // form state + mutation

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FloatingInput } from "@/components/ui/floating-input";
import { useCreateFarm } from "../hooks/use-create-farm";
import { createFarmSchema, type CreateFarmInput } from "../schemas";

/** First-login onboarding: shown when `loginWithBackend` returns `"no-farms"` (see
 * `features/auth/components/login-form.tsx`). Creates the user's first farm and escalates the
 * session to a real farm-scoped token (`lib/auth/session.ts#createFirstFarm`) — no extra step
 * needed, the user lands straight on the dashboard as that farm's Owner. */
export function CreateFarmForm() {
  const router = useRouter();
  const createFarm = useCreateFarm();
  const t = useTranslations("onboarding.createFarm");
  const form = useForm<CreateFarmInput>({
    resolver: zodResolver(createFarmSchema),
    defaultValues: { agreeToTerms: false },
  });

  async function onSubmit(values: CreateFarmInput) {
    try {
      await createFarm.mutateAsync(values);
      router.push("/dashboard");
    } catch {
      // error surfaced below via createFarm.error
    }
  }

  const formError =
    createFarm.error instanceof ApiError ? createFarm.error.message : createFarm.isError ? t("genericError") : null;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full flex-col items-center gap-[60px]" noValidate>
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-[28px] font-bold leading-[1.4] text-foreground">{t("title")}</h1>
        <p className="text-base text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex w-full flex-col gap-6">
        {formError ? (
          <p role="alert" className="rounded-md bg-destructive-tint px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        <FloatingInput
          id="name"
          label={t("name")}
          autoComplete="organization"
          error={form.formState.errors.name?.message}
          {...form.register("name")}
        />

        <div className="flex flex-col gap-1.5">
          <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <Controller
              control={form.control}
              name="agreeToTerms"
              render={({ field }) => (
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  className="mt-0.5"
                />
              )}
            />
            {t("agreeToTerms")}
          </label>
          {form.formState.errors.agreeToTerms ? (
            <p role="alert" className="text-sm text-destructive">
              {t("agreeToTermsRequired")}
            </p>
          ) : null}
        </div>

        <Button type="submit" disabled={createFarm.isPending} className="h-[52px] w-full rounded-xl">
          {createFarm.isPending ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
