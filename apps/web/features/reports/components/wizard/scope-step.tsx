"use client"; // scope kind radio + group/cattle pickers

import { PawPrint, Users, Globe2, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useWatch } from "react-hook-form";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@rakhal/ui/ui/label";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CattlePicker } from "@/components/shared/cattle-picker";
import { useAnimalGroups } from "@/features/cattle/hooks/use-cattle";
import type { ReportScopeKind } from "../../types";
import { reportScopeKindKey } from "../../lib/labels";
import type { Translate, WizardForm } from "./shared";

const KINDS: ReportScopeKind[] = ["ALL_ELIGIBLE", "GROUP", "SINGLE_COW"];
const DESC: Record<ReportScopeKind, string> = {
  ALL_ELIGIBLE: "scope.allDesc",
  GROUP: "scope.groupDesc",
  SINGLE_COW: "scope.cowDesc",
};

const SCOPE_ICON: Record<ReportScopeKind, LucideIcon> = {
  ALL_ELIGIBLE: Globe2,
  GROUP: Users,
  SINGLE_COW: PawPrint,
};

export function ScopeStep({ form }: { form: WizardForm }) {
  const t = useTranslations() as unknown as Translate;
  const tw = useTranslations("reportsWizard") as unknown as Translate;
  const [kind, groupId, cattleId] = useWatch({ control: form.control, name: ["scopeKind", "groupId", "cattleId"] });
  const errors = form.formState.errors;
  const errorKey = errors.groupId?.message ?? errors.cattleId?.message ?? errors.scopeKind?.message;
  const groups = useAnimalGroups();

  function choose(next: ReportScopeKind) {
    form.setValue("scopeKind", next, { shouldDirty: true });
    form.setValue("groupId", undefined);
    form.setValue("cattleId", undefined);
    form.clearErrors(["scopeKind", "groupId", "cattleId"]);
  }

  return (
    <div className="flex flex-col gap-4">
      <RadioGroup value={kind} onValueChange={(v) => choose(v as ReportScopeKind)} aria-label={tw("scope.legend")} className="flex flex-col gap-2.5">
        {KINDS.map((k) => {
          const id = `wiz-scope-${k}`;
          const isSelected = kind === k;
          const Icon = SCOPE_ICON[k];
          return (
            <Label
              key={k}
              htmlFor={id}
              className={cn(
                "flex min-h-12 cursor-pointer items-start gap-3.5 rounded-2xl border bg-card p-4 transition-all duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                isSelected
                  ? "border-primary ring-2 ring-primary/20 bg-emerald-500/10 shadow-sm"
                  : "border-border hover:border-primary/40 hover:bg-muted/40",
              )}
            >
              <RadioGroupItem id={id} value={k} className="mt-1" />
              <span className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                <Icon className="size-4.5" aria-hidden />
              </span>
              <span className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="text-sm font-semibold text-foreground">{t(reportScopeKindKey(k))}</span>
                <span className="text-xs text-muted-foreground">{tw(DESC[k])}</span>
              </span>
            </Label>
          );
        })}
      </RadioGroup>

      {kind === "GROUP" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="wiz-group">{tw("scope.groupSearchLabel")}</Label>
          {groups.isLoading ? (
            <Skeleton className="h-11 w-full" />
          ) : groups.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {tw("scope.groupLoadError")}{" "}
              <button type="button" className="underline" onClick={() => void groups.refetch()}>
                {tw("catalogue.retry")}
              </button>
            </p>
          ) : (groups.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">{tw("scope.groupEmpty")}</p>
          ) : (
            <Select
              value={groupId ?? ""}
              onValueChange={(v) => {
                form.setValue("groupId", v, { shouldDirty: true });
                form.clearErrors("groupId");
              }}
            >
              <SelectTrigger id="wiz-group" className="h-11 w-full" aria-invalid={!!errors.groupId}>
                <SelectValue placeholder={tw("scope.groupPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {groups.data?.items.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name} ({tw("scope.groupMembers", { count: g.memberCount })})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <p className="text-xs text-muted-foreground">{tw("scope.groupAsOf")}</p>
        </div>
      ) : null}

      {kind === "SINGLE_COW" ? (
        <div className="flex flex-col gap-2">
          <Label>{tw("scope.cowLabel")}</Label>
          <CattlePicker
            value={cattleId}
            placeholder={tw("scope.cowPlaceholder")}
            onValueChange={(id) => {
              form.setValue("cattleId", id, { shouldDirty: true });
              form.clearErrors("cattleId");
            }}
          />
        </div>
      ) : null}

      {errorKey ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {t(errorKey)}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">{tw("scope.presentRule")}</p>
    </div>
  );
}
