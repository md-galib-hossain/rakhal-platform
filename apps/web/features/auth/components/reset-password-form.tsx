"use client"; // form state + mutation

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResetPassword } from "../hooks/use-reset-password";
import { resetPasswordSchema, type ResetPasswordInput } from "../schemas";

export function ResetPasswordForm({ token }: { token: string | undefined }) {
  const resetPassword = useResetPassword();
  const t = useTranslations("auth");
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: token ?? "", newPassword: "" },
  });

  async function onSubmit(values: ResetPasswordInput) {
    setFormError(null);
    try {
      await resetPassword.mutateAsync(values);
      setDone(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("resetPassword.genericError"));
    }
  }

  if (!token) {
    return (
      <div className="space-y-6 text-center">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold text-foreground">{t("resetPassword.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("resetPassword.invalidToken")}</p>
        </div>
        <Button asChild className="w-full">
          <Link href="/forgot-password">{t("resetPassword.requestNew")}</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-tint text-success">
          <CheckCircle2 className="size-6" aria-hidden />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold text-foreground">{t("resetPassword.successTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("resetPassword.successBody")}</p>
        </div>
        <Button asChild className="w-full">
          <Link href="/login">{t("resetPassword.logIn")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold text-foreground">{t("resetPassword.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("resetPassword.subtitle")}</p>
      </div>

      {formError ? (
        <p role="alert" className="rounded-md bg-destructive-tint px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="newPassword">{t("resetPassword.newPassword")}</Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          error={form.formState.errors.newPassword?.message}
          {...form.register("newPassword")}
        />
      </div>

      <Button type="submit" disabled={resetPassword.isPending} className="w-full">
        {resetPassword.isPending ? t("resetPassword.submitting") : t("resetPassword.submit")}
      </Button>
    </form>
  );
}
