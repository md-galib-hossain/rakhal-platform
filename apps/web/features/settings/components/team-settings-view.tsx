"use client"; // list + mutations + dialogs

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { MoreHorizontal, Plus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@/lib/api/errors";
import { Can } from "@/lib/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FloatingInput } from "@/components/ui/floating-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { useRoles, useTeam } from "../hooks/use-team";
import { RolesSection } from "./roles-section";
import {
  useChangeMemberRole,
  useInviteTeamMember,
  useRemoveMember,
  useResendInvite,
  useRevokeInvite,
} from "../hooks/use-team-mutations";
import { inviteTeamMemberSchema, type InviteTeamMemberInput } from "../schemas";
import type { TeamRow } from "../types";

export function TeamSettingsView() {
  const t = useTranslations("settings.team");
  const team = useTeam();
  const roles = useRoles();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TeamRow | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<TeamRow | null>(null);

  const resend = useResendInvite();
  const revoke = useRevokeInvite();
  const removeMember = useRemoveMember();
  const changeRole = useChangeMemberRole();

  if (team.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (team.isError) {
    return <ErrorState description={t("loadError")} onRetry={() => team.refetch()} />;
  }

  const rows = team.data?.members ?? [];
  const roleOptions = roles.data?.roles.filter((r) => r.name !== "Owner") ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <Can I="team.invite">
          <Button onClick={() => setInviteOpen(true)} className="gap-1.5">
            <Plus className="size-4" aria-hidden />
            {t("inviteMember")}
          </Button>
        </Can>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("memberHeader")}</TableHead>
              <TableHead>{t("roleHeader")}</TableHead>
              <TableHead>{t("statusHeader")}</TableHead>
              <TableHead>{t("lastActiveHeader")}</TableHead>
              <TableHead>{t("actionsHeader")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{row.name ?? row.email ?? "—"}</span>
                    {row.email ? <span className="text-xs text-muted-foreground">{row.email}</span> : null}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{row.is_owner ? t("owner") : row.role}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={row.status === "active" ? "secondary" : "outline"}>
                    {t(`statusValues.${row.status}`)}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.last_active_at ? new Date(row.last_active_at).toLocaleDateString() : t("never")}
                </TableCell>
                <TableCell>
                  {row.is_owner ? null : (
                    <RowActions
                      row={row}
                      roleOptions={roleOptions}
                      onResend={() => row.invite_id && resend.mutate(row.invite_id, { onSuccess: () => toast.success(t("resentToast")) })}
                      onRevoke={() => setRevokeTarget(row)}
                      onRemove={() => setRemoveTarget(row)}
                      onChangeRole={(role) =>
                        row.member_id &&
                        changeRole.mutate(
                          { memberId: row.member_id, role },
                          { onSuccess: () => toast.success(t("roleChangedToast")) },
                        )
                      }
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} roleOptions={roleOptions} />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={t("removeConfirmTitle", { name: removeTarget?.name ?? removeTarget?.email ?? "" })}
        body={t("removeConfirmBody")}
        pending={removeMember.isPending}
        onConfirm={() => {
          if (!removeTarget?.member_id) return;
          removeMember.mutate(removeTarget.member_id, {
            onSuccess: () => {
              toast.success(t("removedToast"));
              setRemoveTarget(null);
            },
          });
        }}
      />

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title={t("revokeConfirmTitle")}
        body={t("revokeConfirmBody")}
        pending={revoke.isPending}
        onConfirm={() => {
          if (!revokeTarget?.invite_id) return;
          revoke.mutate(revokeTarget.invite_id, {
            onSuccess: () => {
              toast.success(t("revokedToast"));
              setRevokeTarget(null);
            },
          });
        }}
      />

      <RolesSection />
    </div>
  );
}

function RowActions({
  row,
  roleOptions,
  onResend,
  onRevoke,
  onRemove,
  onChangeRole,
}: {
  row: TeamRow;
  roleOptions: { id: string; name: string }[];
  onResend: () => void;
  onRevoke: () => void;
  onRemove: () => void;
  onChangeRole: (role: string) => void;
}) {
  const t = useTranslations("settings.team");
  const isInvite = row.status !== "active";

  return (
    <Can I="team.invite">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isInvite ? (
            <>
              <DropdownMenuItem onClick={onResend}>{t("resend")}</DropdownMenuItem>
              <DropdownMenuItem onClick={onRevoke} className="text-destructive">
                {t("revoke")}
              </DropdownMenuItem>
            </>
          ) : (
            <>
              {roleOptions.map((r) => (
                <DropdownMenuItem key={r.id} onClick={() => onChangeRole(r.name)}>
                  {t("changeRole")}: {r.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={onRemove} className="text-destructive">
                {t("remove")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </Can>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  roleOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleOptions: { id: string; name: string }[];
}) {
  const t = useTranslations("settings.team.inviteModal");
  const tRoot = useTranslations("settings.team");
  const invite = useInviteTeamMember();
  const form = useForm<InviteTeamMemberInput>({
    resolver: zodResolver(inviteTeamMemberSchema),
    defaultValues: { email: "", phone: "", name: "", role: "Worker" },
  });

  async function onSubmit(values: InviteTeamMemberInput) {
    try {
      await invite.mutateAsync({ ...values, phone: values.phone || undefined });
      toast.success(tRoot("invitedToast", { email: values.email }));
      form.reset({ email: "", phone: "", name: "", role: "Worker" });
      onOpenChange(false);
    } catch (err) {
      form.setError("root", { message: err instanceof ApiError ? err.message : t("genericError") });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-4" noValidate>
          {form.formState.errors.root ? (
            <p role="alert" className="rounded-md bg-destructive-tint px-3 py-2 text-sm text-destructive">
              {form.formState.errors.root.message}
            </p>
          ) : null}
          <FloatingInput
            id="team-invite-email"
            type="email"
            label={t("email")}
            error={form.formState.errors.email?.message}
            {...form.register("email")}
          />
          <FloatingInput id="team-invite-name" label={t("name")} {...form.register("name")} />
          <FloatingInput
            id="team-invite-phone"
            label={t("phone")}
            error={form.formState.errors.phone?.message}
            {...form.register("phone")}
          />
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t("role")} />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.length > 0
                    ? roleOptions.map((r) => (
                        <SelectItem key={r.id} value={r.name}>
                          {r.name}
                        </SelectItem>
                      ))
                    : ["Manager", "Worker"].map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            )}
          />
          <SheetFooter className="border-t border-dashed border-border pt-4">
            <Button type="submit" disabled={invite.isPending}>
              {invite.isPending ? t("submitting") : t("submit")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  const t = useTranslations("settings.team");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{body}</SheetDescription>
        </SheetHeader>
        <SheetFooter className="border-t border-dashed border-border pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {t("confirm")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
