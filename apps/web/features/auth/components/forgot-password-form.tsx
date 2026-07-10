"use client"; // form state + mutation

import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { FloatingInput } from "@/components/ui/floating-input";
import { useForgotPassword } from "../hooks/use-forgot-password";
import { forgotPasswordSchema, type ForgotPasswordInput } from "../schemas";

export function ForgotPasswordForm() {
  const forgotPassword = useForgotPassword();
  const t = useTranslations("auth");
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordInput) {
    setFormError(null);
    try {
      await forgotPassword.mutateAsync(values);
      setSentTo(values.email);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("forgotPassword.genericError"));
    }
  }

  if (sentTo) {
    return (
      <div className="flex w-full flex-col items-center gap-[60px] text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-tint text-success">
          <Mail className="size-6" aria-hidden />
        </div>
        <div className="flex flex-col gap-3">
          <h1 className="text-[28px] font-bold leading-[1.4] text-foreground">{t("forgotPassword.successTitle")}</h1>
          <p className="text-base text-muted-foreground">{t("forgotPassword.successBody", { email: sentTo })}</p>
        </div>
        <Button asChild variant="secondary" className="h-[52px] w-full rounded-xl">
          <Link href="/login">{t("forgotPassword.backToLogin")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full flex-col items-center gap-[60px]" noValidate>
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-[28px] font-bold leading-[1.4] text-foreground">{t("forgotPassword.title")}</h1>
        <p className="text-base text-muted-foreground">{t("forgotPassword.subtitle")}</p>
      </div>

      <div className="flex w-full flex-col items-center gap-6">
        {formError ? (
          <p role="alert" className="w-full rounded-md bg-destructive-tint px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        <FloatingInput
          id="email"
          type="email"
          label={t("forgotPassword.email")}
          autoComplete="email"
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />

        <div className="flex w-full flex-col items-center gap-4">
          <Button type="submit" disabled={forgotPassword.isPending} className="h-[52px] w-full rounded-xl">
            {forgotPassword.isPending ? t("forgotPassword.submitting") : t("forgotPassword.submit")}
          </Button>
          <Link href="/login" className="p-1 text-sm font-medium text-primary underline">
            {t("forgotPassword.backToLogin")}
          </Link>
        </div>
      </div>
    </form>
  );
}
