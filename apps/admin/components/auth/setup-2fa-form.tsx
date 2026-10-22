"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@rakhal/ui/ui/button";
import { Input } from "@rakhal/ui/ui/input";
import { Label } from "@rakhal/ui/ui/label";
import { postJson } from "@/lib/api/browser";
import { codeSchema, type CodeInput } from "@/lib/auth/schemas";
import { FormError } from "./auth-card";

interface Enrolment {
  secret: string;
  otpauthUrl: string;
}

/** First-time 2FA enrolment: shows the secret once (QR + manual key), then confirms with a live code. */
export function Setup2faForm() {
  const router = useRouter();
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const started = useRef(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CodeInput>({ resolver: zodResolver(codeSchema), defaultValues: { code: "" } });

  useEffect(() => {
    // Issue the secret exactly once; a re-render or strict-mode double effect must not rotate it.
    if (started.current) return;
    started.current = true;
    void postJson<Enrolment>("/api/auth/2fa/setup").then((res) => {
      if (res.ok && res.data) setEnrolment(res.data);
      else if (res.status === 401) router.replace("/login");
      else setLoadError(res.message ?? "Could not start 2FA setup.");
    });
  }, [router]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const res = await postJson("/api/auth/2fa/enable", values);
    if (!res.ok) {
      if (res.status === 401 && !res.message?.toLowerCase().includes("code")) {
        router.replace("/login");
        return;
      }
      setFormError(res.message ?? "That code was not accepted.");
      return;
    }
    router.replace("/login?2fa=enabled");
  });

  if (loadError) return <FormError message={loadError} />;
  if (!enrolment) return <p className="text-sm text-muted-foreground">Preparing your authenticator setup...</p>;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground">
        <li>Open an authenticator app (Google Authenticator, 1Password, Authy).</li>
        <li>Scan the QR code, or enter the key by hand.</li>
        <li>Type the 6-digit code it shows.</li>
      </ol>
      <div className="flex justify-center rounded-md bg-white p-3">
        <QRCodeSVG value={enrolment.otpauthUrl} size={176} title="Authenticator QR code" />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Manual entry key</p>
        <code className="block break-all rounded-md bg-muted px-3 py-2 text-sm">{enrolment.secret}</code>
      </div>
      <FormError message={formError} />
      <div className="space-y-1.5">
        <Label htmlFor="code">Authentication code</Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          error={errors.code?.message}
          {...register("code")}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Verifying..." : "Turn on 2FA"}
      </Button>
    </form>
  );
}
