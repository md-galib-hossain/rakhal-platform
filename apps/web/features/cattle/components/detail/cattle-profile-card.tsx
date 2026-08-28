"use client"; // reads the active locale for date formatting

import { useTranslations } from "next-intl";
import {
  Activity,
  Baby,
  Calendar,
  CalendarClock,
  Clock,
  Droplet,
  Heart,
  Home,
  Milk,
  Tag,
  VenusAndMars,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { Card } from "@/components/ui/card";
import { DateText } from "@/components/shared/date-text";
import { useMilkEligibility } from "@/features/milk/hooks/use-milk";
import type { MilkEligibilityStatus } from "@/features/milk/types";
import { avatarTint } from "../../avatar-tint";
import { ANIMAL_CATEGORY_VARIANT } from "../../utils/animal-category-style";
import type { CattleDetail, ProductionStatus } from "../../types";

/** RAKHAL — profile redesign (no ticket #): `Status`/`DIM` are the only two header fields that
 * always render something (never conditionally omitted like Pregnant Status/Lactation
 * Stage/Milk Eligibility below), so a bare "—" there reads as a data gap even when it's actually
 * category-driven (a Calf/Heifer/male animal genuinely has no production state). Surface *why* instead of a dash. */
type ProductionUnavailableReason = "male" | "immature";

function getProductionUnavailableReason(cattle: CattleDetail): ProductionUnavailableReason | null {
  if (cattle.gender !== "FEMALE") return "male";
  if (cattle.animalCategory === "CALF" || cattle.animalCategory === "HEIFER") return "immature";
  return null;
}

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
 * DOB/Age, Status/DIM/Pregnant Status. */
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
  const isMilkEligible = cattle.gender === "FEMALE";
  const eligibilityQuery = useMilkEligibility(isMilkEligible ? cattle.id : undefined);
  const eligibility = eligibilityQuery.data;
  const productionUnavailableReason = getProductionUnavailableReason(cattle);

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

      {/* RAKHAL — profile redesign (no ticket #): 3 labeled sections instead of one flat grid, so
          a farmer can scan by purpose (who / how old & where / production+breeding state) instead
          of hunting through a uniform wall of fields — same grouping for every `animalCategory`,
          just with fewer applicable values for immature/male animals. */}
      <FieldSection label={t("sections.identity")}>
        <Field
          icon={Tag}
          label={t("category")}
          value={
            <Chip variant={ANIMAL_CATEGORY_VARIANT[cattle.animalCategory]}>
              {t(`animalCategoryOptions.${cattle.animalCategory}`)}
            </Chip>
          }
        />
        <Field icon={Tag} label={t("breed")} value={cattle.breed?.name ?? "—"} />
        <Field icon={VenusAndMars} label={t("gender")} value={t(`genderOptions.${cattle.gender}`)} />
      </FieldSection>

      <FieldSection label={t("sections.lifeStage")} bordered>
        <Field icon={Home} label={t("shed")} value={cattle.shed?.name ?? "—"} />
        <Field
          icon={Calendar}
          label={t("dateOfBirth")}
          value={cattle.dateOfBirth ? <DateText date={cattle.dateOfBirth} /> : "—"}
        />
        <Field icon={Clock} label={t("age")} value={age ?? "—"} />
      </FieldSection>

      <FieldSection label={t("sections.production")} bordered>
        <Field
          icon={Activity}
          label={t("status")}
          value={
            cattle.productionStatus ? (
              <Chip variant={PRODUCTION_STATUS_VARIANT[cattle.productionStatus]}>
                {t(`statusOptions.${cattle.productionStatus.toLowerCase()}`)}
              </Chip>
            ) : productionUnavailableReason ? (
              <span className="font-normal text-muted-foreground">
                {t(`notApplicable.${productionUnavailableReason}`)}
              </span>
            ) : (
              "—"
            )
          }
        />
        <Field
          icon={CalendarClock}
          label={t("dim")}
          value={
            cattle.dim != null
              ? t("dimValue", { days: cattle.dim })
              : productionUnavailableReason
                ? <span className="font-normal text-muted-foreground">{t(`notApplicable.${productionUnavailableReason}`)}</span>
                : "—"
          }
        />
        {pregnantStatus ? <Field icon={Baby} label={t("pregnantStatus")} value={pregnantStatus} /> : null}
        {/* RAKHAL-273 — supplementary info, not filterable tiles (per the ticket's own guidance),
            so plain `Field`s alongside the existing status/DIM/pregnant fields rather than a
            separate section. Only rendered when applicable (null otherwise). */}
        {cattle.lactationStage ? (
          <Field icon={Milk} label={t("lactationStage")} value={t(`lactationStageOptions.${cattle.lactationStage}`)} />
        ) : null}
        {cattle.pregnancyStage ? (
          <Field icon={Heart} label={t("pregnancyStage")} value={t(`pregnancyStageOptions.${cattle.pregnancyStage}`)} />
        ) : null}
        {/* RAKHAL-278 — animal-level milk eligibility (distinct from the per-session `disposition`
            shown in the Milk Log table). Only fetched/rendered for milking-purpose females. */}
        {eligibility ? (
          <Field
            icon={Droplet}
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
      </FieldSection>

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

/** Labeled group of `Field`s. `bordered` matches the reproduction-alerts block below (`border-t
 * border-border pt-4`) so every section boundary in the card reads the same way. */
function FieldSection({
  label,
  bordered,
  children,
}: {
  label: string;
  bordered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-3", bordered && "border-t border-border pt-4")}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">{children}</div>
    </div>
  );
}

function Field({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon: LucideIcon }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-[18px] shrink-0 text-muted-foreground" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}
