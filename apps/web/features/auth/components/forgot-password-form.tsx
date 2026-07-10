"use client"; // form state + mutation

import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <div className="space-y-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-tint text-success">
          <Mail className="size-6" aria-hidden />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold text-foreground">{t("forgotPassword.successTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("forgotPassword.successBody", { email: sentTo })}</p>
        </div>
        <Button asChild variant="secondary" className="w-full">
          <Link href="/login">{t("forgotPassword.backToLogin")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold text-foreground">{t("forgotPassword.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("forgotPassword.subtitle")}</p>
      </div>

      {formError ? (
        <p role="alert" className="rounded-md bg-destructive-tint px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="email">{t("forgotPassword.email")}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />
      </div>

      <Button type="submit" disabled={forgotPassword.isPending} className="w-full">
        {forgotPassword.isPending ? t("forgotPassword.submitting") : t("forgotPassword.submit")}
      </Button>

      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t("forgotPassword.backToLogin")}
        </Link>
      </p>
    </form>
  );
}
