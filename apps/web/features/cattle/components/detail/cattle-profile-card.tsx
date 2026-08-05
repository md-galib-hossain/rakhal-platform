"use client"; // reads the active locale for date formatting

import { useTranslations } from "next-intl";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { Card } from "@/components/ui/card";
import { DateText } from "@/components/shared/date-text";
import { useMilkEligibility } from "@/features/milk/hooks/use-milk";
import type { MilkEligibilityStatus } from "@/features/milk/types";
import { avatarTint } from "../../avatar-tint";
import type { AnimalCategory, CattleDetail, ProductionStatus } from "../../types";

const PRODUCTION_STATUS_VARIANT: Record<ProductionStatus, "primary" | "info" | "warning" | "muted" | "destructive"> = {
  MILKING: "primary",
  DRY: "warning",
};

/** RAKHAL-270 — mirrors `cattle-columns.tsx`'s `ANIMAL_CATEGORY_VARIANT` (kept per-file, same
 * pattern `PRODUCTION_STATUS_VARIANT` above already uses across both files). */
const ANIMAL_CATEGORY_VARIANT: Record<AnimalCategory, "primary" | "info" | "warning" | "muted" | "destructive" | "teal" | "purple" | "indigo"> = {
  CALF: "info",
  HEIFER: "purple",
  COW: "primary",
  BULL: "indigo",
  STEER: "teal",
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
/** RAKHAL-278 — matches the backend's `MILKING_PURPOSES` (`milk.service.ts`), the same purposes
 * `GET /milk/log` itself queries for, so eligibility is only fetched/shown where it's meaningful. */
const MILK_ELIGIBLE_PURPOSES = ["MILK", "DUAL_PURPOSE"];

const MILK_ELIGIBILITY_VARIANT: Record<MilkEligibilityStatus, "primary" | "destructive" | "info" | "warning"> = {
  SALEABLE: "primary",
  WITHHELD: "destructive",
  COLOSTRUM: "info",
  DISCARD_REQUIRED: "warning",
};

export function CattleProfileCard({ cattle }: { cattle: CattleDetail }) {
  const t = useTranslations("cattle.detail");
  const age = ageFromDob(cattle.dateOfBirth);
  const pregnantStatus =
    cattle.gender === "FEMALE" && cattle.reproductiveStatus
      ? t(`pregnantOptions.${cattle.reproductiveStatus === "PREGNANT" ? "positive" : "negative"}`)
      : null;
  const isMilkEligible = cattle.gender === "FEMALE" && MILK_ELIGIBLE_PURPOSES.includes(cattle.purpose);
  const eligibilityQuery = useMilkEligibility(isMilkEligible ? cattle.id : undefined);
  const eligibility = eligibilityQuery.data;

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
        <Field
          label={t("category")}
          value={
            <Chip variant={ANIMAL_CATEGORY_VARIANT[cattle.animalCategory]}>
              {t(`animalCategoryOptions.${cattle.animalCategory}`)}
            </Chip>
          }
        />
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
        {/* RAKHAL-273 — supplementary info, not filterable tiles (per the ticket's own guidance),
            so plain `Field`s alongside the existing status/DIM/pregnant fields rather than a
            separate section. Only rendered when applicable (null otherwise). */}
        {cattle.lactationStage ? (
          <Field label={t("lactationStage")} value={t(`lactationStageOptions.${cattle.lactationStage}`)} />
        ) : null}
        {cattle.pregnancyStage ? (
          <Field label={t("pregnancyStage")} value={t(`pregnancyStageOptions.${cattle.pregnancyStage}`)} />
        ) : null}
        {/* RAKHAL-278 — animal-level milk eligibility (distinct from the per-session `disposition`
            shown in the Milk Log table). Only fetched/rendered for milking-purpose females. */}
        {eligibility ? (
          <Field
            label={t("milkEligibility")}
            value={
              <span
                title={
                  eligibility.reasons.length > 0
                    ? eligibility.reasons.map((r) => t(`milkRestrictionReasonOptions.${r}`)).join(", ")
                    : undefined
                }
              >
                <Chip variant={MILK_ELIGIBILITY_VARIANT[eligibility.primaryStatus]}>
                  {t(`milkEligibilityOptions.${eligibility.primaryStatus}`)}
                </Chip>
              </span>
            }
          />
        ) : null}
      </div>

      {/* RAKHAL-272 — full reproduction-alerts list (detail view gets the complete badge row; the
          table only has room for a compact count, see `ReproductionAlertsIndicator`). */}
      {cattle.reproductionAlerts.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">{t("reproductionAlerts")}</p>
          <div className="flex flex-wrap gap-2">
            {cattle.reproductionAlerts.map((alert) => (
              <Chip key={alert} variant="warning">
                {t(`reproductionAlertOptions.${alert}`)}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
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
