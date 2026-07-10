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
import { useRegister } from "../hooks/use-register";
import { registerSchema, type RegisterInput } from "../schemas";

export function RegisterForm() {
  const register = useRegister();
  const t = useTranslations("auth");
  const [formError, setFormError] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  const form = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values: RegisterInput) {
    setFormError(null);
    try {
      await register.mutateAsync(values);
      setRegisteredEmail(values.email);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("register.genericError"));
    }
  }

  if (registeredEmail) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-tint text-success">
          <Mail className="size-6" aria-hidden />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold text-foreground">{t("register.successTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("register.successBody", { email: registeredEmail })}
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/login">{t("register.backToLogin")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold text-foreground">{t("register.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("register.subtitle")}</p>
      </div>

      {formError ? (
        <p role="alert" className="rounded-md bg-destructive-tint px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">{t("register.name")}</Label>
          <Input id="name" autoComplete="name" error={form.formState.errors.name?.message} {...form.register("name")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">{t("register.email")}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            error={form.formState.errors.email?.message}
            {...form.register("email")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">{t("register.password")}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            error={form.formState.errors.password?.message}
            {...form.register("password")}
          />
          {!form.formState.errors.password ? (
            <p className="text-xs text-muted-foreground">{t("register.passwordHint")}</p>
          ) : null}
        </div>
      </div>

      <Button type="submit" disabled={register.isPending} className="w-full">
        {register.isPending ? t("register.submitting") : t("register.submit")}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t("register.haveAccount")}{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t("register.logIn")}
        </Link>
      </p>
    </form>
  );
}
