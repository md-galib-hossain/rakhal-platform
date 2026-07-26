"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { FloatingInput } from "@/components/ui/floating-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInviteTeamMember } from "../hooks/use-invite-team-member";
import { inviteTeamMemberSchema, type InviteTeamMemberInput } from "../schemas";

/** Wizard Step 4 (PRD §5.1 Step 5) — invite by email (no SMS provider wired yet, same gap
 * `InviteTeamMemberDto`'s own doc comment flags), assign Manager/Worker. This is the wizard's
 * final step: "Finish" calls `POST /onboarding/complete` then redirects to the dashboard. */
export function TeamStep({ onFinish, isFinishing }: { onFinish: () => void; isFinishing: boolean }) {
  const t = useTranslations("onboarding.wizard.team");
  const invite = useInviteTeamMember();
  const [invited, setInvited] = useState<{ email: string; role: string }[]>([]);
  const form = useForm<InviteTeamMemberInput>({
    resolver: zodResolver(inviteTeamMemberSchema),
    defaultValues: { email: "", name: "", role: "Worker" },
  });

  async function onSubmit(values: InviteTeamMemberInput) {
    try {
      await invite.mutateAsync(values);
      setInvited((prev) => [...prev, { email: values.email, role: values.role }]);
      toast.success(t("invitedToast", { email: values.email }));
      form.reset({ email: "", name: "", role: "Worker" });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">{t("description")}</p>

      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <FloatingInput
            id="invite-email"
            label={t("email")}
            type="email"
            error={form.formState.errors.email?.message}
            {...form.register("email")}
          />
          <FloatingInput id="invite-name" label={t("name")} {...form.register("name")} />
        </div>

        <div className="flex flex-col gap-2">
          <Label>{t("role")}</Label>
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manager">{t("roles.manager")}</SelectItem>
                  <SelectItem value="Worker">{t("roles.worker")}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <Button type="submit" variant="outline" className="self-start" disabled={invite.isPending}>
          {invite.isPending ? t("inviting") : t("sendInvite")}
        </Button>
      </form>

      {invited.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {invited.map((m) => (
            <Badge key={m.email} variant="secondary">
              {m.email} · {m.role}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-end border-t border-border pt-4">
        <Button type="button" onClick={onFinish} disabled={isFinishing}>
          {isFinishing ? t("finishing") : t("finish")}
        </Button>
      </div>
    </div>
  );
}
