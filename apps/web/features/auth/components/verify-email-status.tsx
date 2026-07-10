"use client"; // fires the verify-email mutation on mount, needs client-side effect

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useVerifyEmail } from "../hooks/use-verify-email";

export function VerifyEmailStatus({ token }: { token: string | undefined }) {
  const verifyEmail = useVerifyEmail();
  const t = useTranslations("auth.verifyEmail");
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    verifyEmail.mutate(token);
  }, [token, verifyEmail]);

  if (!token) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive-tint text-destructive">
          <XCircle className="size-6" aria-hidden />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold text-foreground">{t("errorTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("invalidToken")}</p>
        </div>
        <Button asChild className="w-full">
          <Link href="/login">{t("backToLogin")}</Link>
        </Button>
      </div>
    );
  }

  if (verifyEmail.isPending || verifyEmail.isIdle) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Loader2 className="size-6 animate-spin" aria-hidden />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("verifying")}</p>
        </div>
      </div>
    );
  }

  if (verifyEmail.isError) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive-tint text-destructive">
          <XCircle className="size-6" aria-hidden />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold text-foreground">{t("errorTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("errorBody")}</p>
        </div>
        <Button asChild className="w-full">
          <Link href="/login">{t("backToLogin")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-tint text-success">
        <CheckCircle2 className="size-6" aria-hidden />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold text-foreground">{t("successTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("successBody")}</p>
      </div>
      <Button asChild className="w-full">
        <Link href="/login">{t("logIn")}</Link>
      </Button>
    </div>
  );
}
