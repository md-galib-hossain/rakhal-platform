"use client"; // reads the active locale for date formatting

import { useTranslations } from "next-intl";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { Card } from "@/components/ui/card";
import { DateText } from "@/components/shared/date-text";
import { avatarTint } from "../../avatar-tint";
import type { CattleDetail, ProductionStatus } from "../../types";

const PRODUCTION_STATUS_VARIANT: Record<ProductionStatus, "primary" | "info" | "warning" | "muted" | "destructive"> = {
  MILKING: "primary",
  DRY: "warning",
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

/** Profile summary header — 64px square photo, name/tag, and the calendar-icon field grid (Figma
 * "Single Cow Details" frame 1042:57994, node 1042:58005) laid out Breed/Gender/Shed,
 * DOB/Age/Purpose, Status/DIM/Pregnant Status. Pregnant Status is derived from the base row's own
 * `reproductiveStatus` (real data, no extra fetch) as Positive/Negative rather than the mock's
 * "Positive (90D)" — the days-pregnant count only exists behind the female-only reproduction-summary
 * call the Reproduction tab already owns, so it isn't duplicated here. */
export function CattleProfileCard({ cattle }: { cattle: CattleDetail }) {
  const t = useTranslations("cattle.detail");
  const age = ageFromDob(cattle.dateOfBirth);
  const pregnantStatus =
    cattle.gender === "FEMALE" && cattle.reproductiveStatus
      ? t(`pregnantOptions.${cattle.reproductiveStatus === "PREGNANT" ? "positive" : "negative"}`)
      : null;

  return (
    <Card className="flex flex-col gap-6 rounded-xl p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Avatar className="size-16 rounded-lg">
            {cattle.profile_photo ? <AvatarImage src={cattle.profile_photo.thumb_url} alt="" /> : null}
            <AvatarFallback className={cn("rounded-lg text-lg", avatarTint(cattle.id))}>
              {(cattle.name ?? cattle.tagNumber).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1.5">
            <p className="text-xl font-bold text-foreground">{cattle.name ?? cattle.tagNumber}</p>
            <p className="text-sm text-muted-foreground">{cattle.tagNumber}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
        <Field label={t("breed")} value={cattle.breed?.name ?? "—"} />
        <Field label={t("gender")} value={t(`genderOptions.${cattle.gender}`)} />
        <Field label={t("shed")} value={cattle.shed?.name ?? "—"} />
        <Field label={t("dateOfBirth")} value={cattle.dateOfBirth ? <DateText date={cattle.dateOfBirth} /> : "—"} />
        <Field label={t("age")} value={age ?? "—"} />
        <Field label={t("purpose")} value={t(`purposeOptions.${cattle.purpose}`)} />
        <Field
          label={t("status")}
          value={
            cattle.productionStatus ? (
              <Chip variant={PRODUCTION_STATUS_VARIANT[cattle.productionStatus]}>
                {t(`statusOptions.${cattle.productionStatus.toLowerCase()}`)}
              </Chip>
            ) : (
              "—"
            )
          }
        />
        <Field label={t("dim")} value={cattle.dim != null ? t("dimValue", { days: cattle.dim }) : "—"} />
        {pregnantStatus ? <Field label={t("pregnantStatus")} value={pregnantStatus} /> : null}
      </div>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Calendar className="mt-0.5 size-[18px] shrink-0 text-muted-foreground" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}
