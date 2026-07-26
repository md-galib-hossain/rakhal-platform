"use client"; // form state + mutation

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { FloatingInput } from "@/components/ui/floating-input";
import { useLogin } from "../hooks/use-login";
import { loginSchema, type LoginInput } from "../schemas";
import type { FarmOption } from "../types";

export function LoginForm() {
  const router = useRouter();
  const login = useLogin();
  const t = useTranslations("auth");
  const [farms, setFarms] = useState<FarmOption[] | null>(null);
  const [selecting, setSelecting] = useState(false);
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
      } else if (result.status === "no-farms") {
        router.push("/onboarding");
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("login.genericError"));
    }
  }

  // I3: escalates the session already persisted by the login call above (real refresh cookie,
  // farmId "") onto the chosen farm via /auth/refresh — no second password submission.
  async function selectFarm(farmId: string) {
    setFormError(null);
    setSelecting(true);
    try {
      const res = await fetch("/api/auth/select-farm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ farmId }),
      });
      const envelope = await res.json();
      if (!envelope.success) throw new ApiError(envelope.code, envelope.message, res.status);
      router.push("/dashboard");
    } catch (err) {
      setSelecting(false);
      setFormError(err instanceof ApiError ? err.message : t("login.genericError"));
    }
  }

  if (farms) {
    return (
      <div className="flex w-full flex-col items-center gap-[60px]">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-[28px] font-bold leading-[1.4] text-foreground">{t("farmPicker.title")}</h1>
          <p className="text-base text-muted-foreground">{t("farmPicker.subtitle")}</p>
        </div>
        <div className="flex w-full flex-col gap-4">
          {formError ? (
            <p role="alert" className="rounded-md bg-destructive-tint px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          <ul className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {farms.map((farm) => (
              <li key={farm.id}>
                <button
                  type="button"
                  disabled={selecting}
                  onClick={() => selectFarm(farm.id)}
                  className="flex w-full items-center justify-between rounded-[14px] border border-input bg-card px-4 py-3 text-left transition-colors hover:bg-muted disabled:opacity-50"
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
            disabled={selecting}
            onClick={() => {
              setFarms(null);
              setFormError(null);
            }}
          >
            {t("farmPicker.back")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full flex-col items-center gap-[60px]" noValidate>
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-[28px] font-bold leading-[1.4] text-foreground">{t("login.title")}</h1>
        <p className="text-base text-muted-foreground">
          {t("login.noAccount")}{" "}
          <Link href="/register" className="font-bold text-primary-hover hover:underline">
            {t("login.createAccount")}
          </Link>
        </p>
      </div>

      <div className="flex w-full flex-col gap-6">
        {formError ? (
          <p role="alert" className="rounded-md bg-destructive-tint px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        <div className="flex flex-col items-end gap-2">
          <div className="flex w-full flex-col gap-6">
            <FloatingInput
              id="email"
              type="email"
              label={t("login.email")}
              autoComplete="email"
              error={form.formState.errors.email?.message}
              {...form.register("email")}
            />
            <FloatingInput
              id="password"
              type="password"
              label={t("login.password")}
              autoComplete="current-password"
              error={form.formState.errors.password?.message}
              {...form.register("password")}
            />
          </div>
          <Link href="/forgot-password" className="p-1 text-sm font-medium text-primary-hover hover:underline">
            {t("login.forgotPassword")}
          </Link>
        </div>

        <Button type="submit" disabled={login.isPending} className="h-[52px] w-full rounded-xl">
          {login.isPending ? t("login.submitting") : t("login.submit")}
        </Button>
      </div>
    </form>
  );
}
