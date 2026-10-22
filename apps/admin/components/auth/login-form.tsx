"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@rakhal/ui/ui/button";
import { Input } from "@rakhal/ui/ui/input";
import { Label } from "@rakhal/ui/ui/label";
import { postJson } from "@/lib/api/browser";
import { loginSchema, type LoginInput } from "@/lib/auth/schemas";
import { FormError } from "./auth-card";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", code: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const res = await postJson<{ status: "ok" | "2fa_setup_required" }>("/api/auth/login", values);
    if (!res.ok) {
      setFormError(res.status === 401 ? "Invalid email, password or code." : (res.message ?? "Sign in failed."));
      return;
    }
    if (res.data?.status === "2fa_setup_required") {
      router.replace("/login/setup-2fa");
      return;
    }
    router.replace(next);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormError message={formError} />
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="username" error={errors.email?.message} {...register("email")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="code">Authentication code</Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="6-digit code"
          error={errors.code?.message}
          {...register("code")}
        />
        <p className="text-xs text-muted-foreground">
          Leave empty only if this is your first sign-in (2FA setup follows).
        </p>
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
