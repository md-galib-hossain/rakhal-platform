"use client"; // reads the active locale for date formatting

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DateText } from "@/components/shared/date-text";
import { avatarTint } from "../../avatar-tint";
import type { CattleDetail, ProductionStatus } from "../../types";

const PRODUCTION_STATUS_VARIANT: Record<ProductionStatus, "success" | "info" | "warning" | "secondary" | "destructive"> = {
  MILKING: "success",
  FRESH: "info",
  DRY: "warning",
  GROWING: "secondary",
  SOLD: "secondary",
  DECEASED: "destructive",
};

function ageFromDob(dob: string | null): string | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return years > 0 ? `${years}y ${months}m` : `${months}m`;
}

/** Profile summary header — 64px photo, name/tag, and the labeled field grid (Figma B1-S5). Real
 * gap vs the mock: no "Pregnant Status" field exists on the base cattle row (it needs the
 * reproduction-summary call, female-only) — shown inside the Reproduction tab instead rather than
 * fabricated here. */
export function CattleProfileCard({ cattle }: { cattle: CattleDetail }) {
  const t = useTranslations("cattle.detail");
  const age = ageFromDob(cattle.dateOfBirth);

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          {cattle.profile_photo ? <AvatarImage src={cattle.profile_photo.thumb_url} alt="" /> : null}
          <AvatarFallback className={cn("text-lg", avatarTint(cattle.id))}>
            {(cattle.name ?? cattle.tagNumber).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <p className="text-xl font-bold text-foreground">{cattle.name ?? cattle.tagNumber}</p>
          <p className="text-sm text-muted-foreground">{cattle.tagNumber}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        <Field label={t("breed")} value={cattle.breed?.name ?? "—"} />
        <Field label={t("gender")} value={t(`genderOptions.${cattle.gender}`)} />
        <Field label={t("shed")} value={cattle.shed?.name ?? "—"} />
        <Field label={t("dateOfBirth")} value={cattle.dateOfBirth ? <DateText date={cattle.dateOfBirth} /> : "—"} />
        <Field label={t("age")} value={age ?? "—"} />
        <Field label={t("purpose")} value={t(`purposeOptions.${cattle.purpose}`)} />
        <Field
          label={t("status")}
          value={<Badge variant={PRODUCTION_STATUS_VARIANT[cattle.productionStatus]}>{t(`statusOptions.${cattle.productionStatus.toLowerCase()}`)}</Badge>}
        />
        <Field label={t("dim")} value={cattle.dim != null ? t("dimValue", { days: cattle.dim }) : "—"} />
      </div>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
