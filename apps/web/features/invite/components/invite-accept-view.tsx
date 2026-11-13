"use client"; // form state + mutations + redirect on success

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { ApiError, NetworkError } from "@/lib/api/errors";
import { Button } from "@rakhal/ui/ui/button";
import { FloatingInput } from "@rakhal/ui/ui/floating-input";
import { authApi } from "@/features/auth/api";
import type { InvitePreview } from "../types";

const credentialsSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().email(),
  password: z.string().min(8),
});
type CredentialsInput = z.infer<typeof credentialsSchema>;

interface Props {
  token: string;
  preview: InvitePreview | null;
  notFound: boolean;
  hasSession: boolean;
  sessionEmail: string | null;
}

/** Establishes a bootstrap-scoped session directly (skips the main login page's multi-farm
 * picker dance — irrelevant here since `acceptTeamInvite` immediately escalates onto the
 * invite's farm regardless of what other farms the account belongs to). */
async function loginBootstrap(email: string, password: string): Promise<void> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ email, password, farmId: "bootstrap" }),
  });
  const envelope = await res.json();
  if (!envelope.success) throw new ApiError(envelope.code, envelope.message, res.status);
}

async function acceptInvite(token: string): Promise<{ farmId: string }> {
  const res = await fetch("/api/onboarding/accept-invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ token }),
  });
  const envelope = await res.json();
  if (!envelope.success) throw new ApiError(envelope.code, envelope.message, res.status);
  return envelope.data;
}

export function InviteAcceptView({ token, preview, notFound, hasSession, sessionEmail }: Props) {
  const router = useRouter();
  const t = useTranslations("invite");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CredentialsInput>({ resolver: zodResolver(credentialsSchema) });

  async function finishAccept() {
    setPending(true);
    setError(null);
    try {
      await acceptInvite(token);
      router.push("/dashboard");
    } catch (err) {
      setPending(false);
      setError(err instanceof ApiError ? err.message : err instanceof NetworkError ? t("networkError") : t("genericError"));
    }
  }

  async function onSubmit(values: CredentialsInput) {
    setPending(true);
    setError(null);
    try {
      if (mode === "register") {
        await authApi.register({ name: values.name?.trim() || values.email.split("@")[0], email: values.email, password: values.password });
      }
      await loginBootstrap(values.email, values.password);
      await finishAccept();
    } catch (err) {
      setPending(false);
      setError(err instanceof ApiError ? err.message : err instanceof NetworkError ? t("networkError") : t("genericError"));
    }
  }

  if (notFound || !preview) {
    return (
      <div className="flex w-full flex-col items-center gap-4 text-center">
        <h1 className="text-[28px] font-bold leading-[1.4] text-foreground">{t("notFound.title")}</h1>
        <p className="text-base text-muted-foreground">{t("notFound.body")}</p>
      </div>
    );
  }

  if (preview.status !== "pending") {
    return (
      <div className="flex w-full flex-col items-center gap-4 text-center">
        <h1 className="text-[28px] font-bold leading-[1.4] text-foreground">{t(`status.${preview.status}.title`)}</h1>
        <p className="text-base text-muted-foreground">{t(`status.${preview.status}.body`, { farm: preview.farm_name })}</p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-[60px]">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-[28px] font-bold leading-[1.4] text-foreground">{t("title")}</h1>
        <p className="text-base text-muted-foreground">
          {t("subtitle", { inviter: preview.invited_by, farm: preview.farm_name, role: preview.role })}
        </p>
      </div>

      <div className="flex w-full flex-col gap-6">
        {error ? (
          <p role="alert" className="rounded-md bg-destructive-tint px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {hasSession ? (
          <div className="flex flex-col items-center gap-4">
            {sessionEmail ? (
              <p className="text-sm text-muted-foreground">{t("signedInAs", { email: sessionEmail })}</p>
            ) : null}
            <Button onClick={finishAccept} disabled={pending} className="h-[52px] w-full rounded-xl">
              {pending ? t("accepting") : t("accept")}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 self-center rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${mode === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                {t("tabs.login")}
              </button>
              <button
                type="button"
                onClick={() => setMode("register")}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${mode === "register" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                {t("tabs.register")}
              </button>
            </div>

            <form method="post" onSubmit={form.handleSubmit(onSubmit)} className="flex w-full flex-col gap-4" noValidate>
              {mode === "register" ? (
                <FloatingInput
                  id="invite-name"
                  label={t("name")}
                  autoComplete="name"
                  error={form.formState.errors.name?.message}
                  {...form.register("name")}
                />
              ) : null}
              <FloatingInput
                id="invite-email"
                type="email"
                label={t("email")}
                autoComplete="email"
                error={form.formState.errors.email?.message}
                {...form.register("email")}
              />
              <FloatingInput
                id="invite-password"
                type="password"
                label={t("password")}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                error={form.formState.errors.password?.message}
                {...form.register("password")}
              />
              <Button type="submit" disabled={pending} className="h-[52px] w-full rounded-xl">
                {pending ? t("accepting") : mode === "register" ? t("registerAndAccept") : t("loginAndAccept")}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
