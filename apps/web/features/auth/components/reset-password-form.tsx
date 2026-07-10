"use client"; // form state + mutation

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { FloatingInput } from "@/components/ui/floating-input";
import { useResetPassword } from "../hooks/use-reset-password";
import { resetPasswordFormSchema, type ResetPasswordFormInput } from "../schemas";

export function ResetPasswordForm({ token }: { token: string | undefined }) {
  const resetPassword = useResetPassword();
  const t = useTranslations("auth");
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const form = useForm<ResetPasswordFormInput>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { token: token ?? "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetPasswordFormInput) {
    setFormError(null);
    try {
      await resetPassword.mutateAsync({ token: values.token, newPassword: values.newPassword });
      setDone(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("resetPassword.genericError"));
    }
  }

  if (!token) {
    return (
      <div className="flex w-full flex-col items-center gap-[60px] text-center">
        <div className="flex flex-col gap-3">
          <h1 className="text-[28px] font-bold leading-[1.4] text-foreground">{t("resetPassword.title")}</h1>
          <p className="text-base text-muted-foreground">{t("resetPassword.invalidToken")}</p>
        </div>
        <Button asChild className="h-[52px] w-full rounded-xl">
          <Link href="/forgot-password">{t("resetPassword.requestNew")}</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex w-full flex-col items-center gap-[60px] text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-tint text-success">
          <CheckCircle2 className="size-6" aria-hidden />
        </div>
        <div className="flex flex-col gap-3">
          <h1 className="text-[28px] font-bold leading-[1.4] text-foreground">{t("resetPassword.successTitle")}</h1>
          <p className="text-base text-muted-foreground">{t("resetPassword.successBody")}</p>
        </div>
        <Button asChild className="h-[52px] w-full rounded-xl">
          <Link href="/login">{t("resetPassword.logIn")}</Link>
        </Button>
      </div>
    );
  }

  const confirmError = form.formState.errors.confirmPassword?.message;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full flex-col items-center gap-[60px]" noValidate>
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-[28px] font-bold leading-[1.4] text-foreground">{t("resetPassword.title")}</h1>
        <p className="text-base text-muted-foreground">{t("resetPassword.subtitle")}</p>
      </div>

      <div className="flex w-full flex-col items-center gap-6">
        {formError ? (
          <p role="alert" className="w-full rounded-md bg-destructive-tint px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        <div className="flex w-full flex-col gap-6">
          <FloatingInput
            id="newPassword"
            type="password"
            label={t("resetPassword.newPassword")}
            autoComplete="new-password"
            error={form.formState.errors.newPassword?.message}
            {...form.register("newPassword")}
          />
          <FloatingInput
            id="confirmPassword"
            type="password"
            label={t("resetPassword.confirmPassword")}
            autoComplete="new-password"
            error={confirmError === "passwordMismatch" ? t("resetPassword.passwordMismatch") : confirmError}
            {...form.register("confirmPassword")}
          />
        </div>

        <Button type="submit" disabled={resetPassword.isPending} className="h-[52px] w-full rounded-xl">
          {resetPassword.isPending ? t("resetPassword.submitting") : t("resetPassword.submit")}
        </Button>
      </div>
    </form>
  );
}
