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
      <div className="flex w-full flex-col items-center gap-[60px] text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-tint text-success">
          <Mail className="size-6" aria-hidden />
        </div>
        <div className="flex flex-col gap-3">
          <h1 className="text-[28px] font-bold leading-[1.4] text-foreground">{t("register.successTitle")}</h1>
          <p className="text-base text-muted-foreground">
            {t("register.successBody", { email: registeredEmail })}
          </p>
        </div>
        <Button asChild className="h-[52px] w-full rounded-xl">
          <Link href="/login">{t("register.backToLogin")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full flex-col items-center gap-[60px]" noValidate>
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-[28px] font-bold leading-[1.4] text-foreground">{t("register.title")}</h1>
        <p className="text-base text-muted-foreground">
          {t("register.haveAccount")}{" "}
          <Link href="/login" className="font-bold text-primary hover:underline">
            {t("register.logIn")}
          </Link>
        </p>
      </div>

      <div className="flex w-full flex-col items-center gap-6">
        {formError ? (
          <p role="alert" className="w-full rounded-md bg-destructive-tint px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        <div className="flex w-full flex-col gap-6">
          <FloatingInput
            id="name"
            label={t("register.name")}
            autoComplete="name"
            error={form.formState.errors.name?.message}
            {...form.register("name")}
          />
          <FloatingInput
            id="email"
            type="email"
            label={t("register.email")}
            autoComplete="email"
            error={form.formState.errors.email?.message}
            {...form.register("email")}
          />
          <div>
            <FloatingInput
              id="password"
              type="password"
              label={t("register.password")}
              autoComplete="new-password"
              error={form.formState.errors.password?.message}
              {...form.register("password")}
            />
            {!form.formState.errors.password ? (
              <p className="mt-1.5 text-xs text-muted-foreground">{t("register.passwordHint")}</p>
            ) : null}
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-4">
          <Button type="submit" disabled={register.isPending} className="h-[52px] w-full rounded-xl">
            {register.isPending ? t("register.submitting") : t("register.submit")}
          </Button>
        </div>
      </div>
    </form>
  );
}
