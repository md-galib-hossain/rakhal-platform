"use client"; // form state + mutation

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin } from "../hooks/use-login";
import { loginSchema, type LoginInput } from "../schemas";
import type { FarmOption } from "../types";

export function LoginForm() {
  const router = useRouter();
  const login = useLogin();
  const t = useTranslations("auth");
  const [farms, setFarms] = useState<FarmOption[] | null>(null);
  const [credentials, setCredentials] = useState<LoginInput | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    try {
      const result = await login.mutateAsync(values);
      if (result.status === "ok") {
        router.push("/dashboard");
      } else if (result.status === "select-farm") {
        setFarms(result.farms);
        setCredentials(values);
      } else {
        setFormError(t("login.genericError"));
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("login.genericError"));
    }
  }

  async function selectFarm(farmId: string) {
    if (!credentials) return;
    setFormError(null);
    try {
      const result = await login.mutateAsync({ ...credentials, farmId });
      if (result.status === "ok") router.push("/dashboard");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("login.genericError"));
    }
  }

  if (farms) {
    return (
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold text-foreground">{t("farmPicker.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("farmPicker.subtitle")}</p>
        </div>
        {formError ? (
          <p role="alert" className="rounded-md bg-destructive-tint px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        ) : null}
        <ul className="space-y-2">
          {farms.map((farm) => (
            <li key={farm.id}>
              <button
                type="button"
                disabled={login.isPending}
                onClick={() => selectFarm(farm.id)}
                className="flex w-full items-center justify-between rounded-md border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted disabled:opacity-50"
              >
                <span className="font-semibold text-foreground">{farm.name}</span>
                <span className="text-sm text-muted-foreground">{farm.role}</span>
              </button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          disabled={login.isPending}
          onClick={() => {
            setFarms(null);
            setCredentials(null);
            setFormError(null);
          }}
        >
          {t("farmPicker.back")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold text-foreground">{t("login.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("login.subtitle")}</p>
      </div>

      {formError ? (
        <p role="alert" className="rounded-md bg-destructive-tint px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("login.email")}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            error={form.formState.errors.email?.message}
            {...form.register("email")}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("login.password")}</Label>
            <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
              {t("login.forgotPassword")}
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            error={form.formState.errors.password?.message}
            {...form.register("password")}
          />
        </div>
      </div>

      <Button type="submit" disabled={login.isPending} className="w-full">
        {login.isPending ? t("login.submitting") : t("login.submit")}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t("login.noAccount")}{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          {t("login.createAccount")}
        </Link>
      </p>
    </form>
  );
}
