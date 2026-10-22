"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@rakhal/ui/ui/button";
import { Input } from "@rakhal/ui/ui/input";
import { Label } from "@rakhal/ui/ui/label";
import { postJson } from "@/lib/api/browser";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/auth/schemas";
import { FormError } from "./auth-card";

export function ChangePasswordForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const res = await postJson("/api/auth/change-password", values);
    if (!res.ok) {
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      setFormError(res.message ?? "Could not change the password.");
      return;
    }
    router.replace("/");
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormError message={formError} />
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register("currentPassword")}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          error={errors.newPassword?.message}
          {...register("newPassword")}
        />
        <p className="text-xs text-muted-foreground">
          At least 12 characters with upper and lower case letters and a digit.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Change password"}
      </Button>
    </form>
  );
}
