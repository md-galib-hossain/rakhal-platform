"use client"; // form state + mutation + staged photo upload

import { useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Info, Plus, Sparkles, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ApiError } from "@/lib/api/errors";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CattlePicker } from "@/components/shared/cattle-picker";
import { Chip, type ChipProps } from "@/components/ui/chip";
import {
  LabeledInput,
  LabeledSelectTrigger,
} from "@/components/ui/labeled-field";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import {
  useBreeds,
  useCreateBreed,
  useCreateCattle,
  useCreatePurchasedLactation,
  useFeedGroups,
  useRemoveCattlePhoto,
  useSetCattlePhoto,
  useSheds,
  useUpdateCattle,
  useUpdateCattleStatus,
} from "../hooks/use-cattle";
import { cattleEditFormSchema, type CattleEditFormInput } from "../schemas";
import { deriveAnimalCategoryPreview } from "../utils/animal-category-preview";
import type { AnimalCategory, CattleDetail, CattleFormPayload } from "../types";

const UNSET = "__unset__";
const ADD_NEW_BREED = "__add_new_breed__";

const GENDERS = ["MALE", "FEMALE", "CASTRATED_MALE"] as const;
const PURPOSES = [
  "MILK",
  "BREEDING",
  "MEAT",
  "CALF",
  "BULL_SERVICE",
  "DUAL_PURPOSE",
] as const;
const SOURCE_TYPES = ["BORN", "PURCHASED", "GIFTED", "UNKNOWN"] as const;
const BREEDING_METHODS = ["AI", "NATURAL", "EMBRYO_TRANSFER"] as const;
// RAKHAL-status-fold: ported from `CattleStatusDialog`.
const PRODUCTION_STATUSES = ["MILKING", "DRY"] as const;
const REPRODUCTIVE_STATUSES = [
  "NOT_ELIGIBLE",
  "POSTPARTUM_WAITING",
  "OPEN",
  "BRED_AWAITING_CONFIRMATION",
  "PREGNANT",
] as const;

/** RAKHAL-270 chip colors — mirrors `cattle-columns.tsx`'s `ANIMAL_CATEGORY_VARIANT` (kept
 * per-file, same reasoning as `cattle-profile-card.tsx`'s own copy: no shared cross-feature
 * constants module exists for this yet). */
const ANIMAL_CATEGORY_VARIANT: Record<AnimalCategory, ChipProps["variant"]> = {
  CALF: "info",
  HEIFER: "purple",
  COW: "primary",
  BULL: "indigo",
  STEER: "teal",
};

/** Strips the `""`/`UNSET` sentinel back to `undefined` before hitting the API — the backend's
 * optional string fields reject an empty string differently than an omitted key in some paths
 * (`@IsOptional` only skips `undefined`), so never send `""`/sentinel on the wire. */
/** RAKHAL-319-F — only sent create-mode (an edit is always a `PATCH`, and the backend's intake
 * fields live on `CreateCattleDto` only). Mode is exclusive: `bred` and `heat` never both fire. */
function toPayload(values: CattleEditFormInput, isEdit: boolean): CattleFormPayload {
  const clean = <T,>(v: T | "" | typeof UNSET | undefined): T | undefined =>
    v === "" || v === UNSET || v === undefined ? undefined : v;
  return {
    name: clean(values.name),
    tagNumber: values.tagNumber,
    breedId: clean(values.breedId),
    gender: values.gender,
    dateOfBirth: clean(values.dateOfBirth),
    purpose: values.purpose,
    shedId: clean(values.shedId),
    feedGroupId: clean(values.feedGroupId),
    motherId: clean(values.motherId),
    fatherId: clean(values.fatherId),
    sourceType: clean(values.sourceType),
    weightKg: values.weightKg,
    color: clean(values.color),
    notes: clean(values.notes),
    priorCalvings: values.gender === "FEMALE" ? values.priorCalvings : undefined,
    intakeBreeding:
      !isEdit && values.intakeReproductionMode === "bred" && values.intakeBreedingDate
        ? {
            breedingDate: values.intakeBreedingDate,
            breedingMethod: values.intakeBreedingMethod,
            notes: clean(values.intakeBreedingNotes),
          }
        : undefined,
    intakeHeat:
      !isEdit && values.intakeReproductionMode === "heat" && values.intakeHeatDateTime
        ? { heatDateTime: values.intakeHeatDateTime, notes: clean(values.intakeHeatNotes) }
        : undefined,
  };
}

function toFormDefaults(
  cattle: CattleDetail | undefined,
  initialValues: Partial<CattleEditFormInput> | undefined,
): Partial<CattleEditFormInput> {
  if (!cattle) return { gender: "FEMALE", purpose: "MILK", ...initialValues };
  return {
    name: cattle.name ?? "",
    tagNumber: cattle.tagNumber,
    breedId: cattle.breed?.id ?? undefined,
    gender: cattle.gender,
    dateOfBirth: cattle.dateOfBirth ? cattle.dateOfBirth.slice(0, 10) : "",
    purpose: cattle.purpose,
    shedId: cattle.shedId ?? undefined,
    feedGroupId: cattle.feedGroupId ?? undefined,
    motherId: cattle.motherId ?? undefined,
    fatherId: cattle.fatherId ?? undefined,
    sourceType: cattle.sourceType ?? undefined,
    weightKg: cattle.lastWeightKg ?? undefined,
    color: cattle.color ?? "",
    notes: cattle.notes ?? "",
    // RAKHAL-status-fold: former `CattleStatusDialog` defaults, folded in for edit mode.
    productionStatus: cattle.productionStatus ?? undefined,
    reproductiveStatus: cattle.reproductiveStatus ?? undefined,
  };
}

/** Square "+ Add Cow Image" dropzone — pixel-matched to the Figma "Add New Cattle" modal
 * (`rakhal-ui-analysis.md` B1-S4): dashed border, muted fill, centered plus icon + 2-line label.
 * Local-only until Save — the backend's photo endpoint needs an existing cattle id, so a freshly
 * picked file is staged here and uploaded right after create/update succeeds (see `onSubmit`). */
function PhotoDropzone({
  previewUrl,
  onPick,
  onClear,
  label,
}: {
  previewUrl: string | null;
  onPick: (file: File) => void;
  onClear: () => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative size-[110px] shrink-0">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex size-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-input bg-muted text-center transition-colors hover:bg-muted/70"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- transient local object-URL / signed R2 URL preview
          <img
            src={previewUrl}
            alt=""
            className="size-full rounded-xl object-cover"
          />
        ) : (
          <>
            <Plus className="size-5 text-muted-foreground" aria-hidden />
            <span className="px-2 text-xs leading-tight text-muted-foreground">
              {label}
            </span>
          </>
        )}
      </button>
      {previewUrl ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Remove"
          className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-xs hover:text-destructive"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/**
 * RFE-022 — one dialog for both create and edit (`cattle` present = edit). Pixel-matched to the
 * Figma "Add New Cattle" modal (`rakhal-ui-analysis.md` B1-S4: dashed header/footer separators,
 * "Basic Info" muted band, stacked-label fields, square photo dropzone, equal-width footer
 * buttons) — built on raw `Dialog` primitives rather than the generic `FormDialog`/`FormSheet`
 * chrome, which don't support this layout. Figma only pictures "Basic Info"; the PRD's remaining
 * `CreateCattleDto` fields (feed group, source, parents, color, weight, notes) get a second
 * "Additional Info" band in the same visual language (ui-analysis.md flags these as PRD-spec, not
 * pictured) rather than being dropped.
 *
 * Photo is staged locally (`photoFile`/`clearExistingPhoto` state) and only hits the wire on Save,
 * right after create/update returns a cattle id — matches the Figma flow (one "Save Cattle"
 * click) despite the backend's photo upload being a separate endpoint from create/update.
 */
export function CattleFormDialog({
  open,
  onOpenChange,
  cattle,
  initialValues,
  onRequestReproductionAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cattle?: CattleDetail;
  /** RAKHAL-298 — create-mode-only prefill (e.g. the category-highlight tiles' quick-add: Heifer
   * prefills `gender: "FEMALE"`, Calf prefills `purpose: "CALF"` + today's `dateOfBirth`). Ignored
   * when `cattle` is set (edit mode always loads the existing cow's own values). */
  initialValues?: Partial<CattleEditFormInput>;
  /** RAKHAL-status-fold-p4 — edit-mode only. Picking a status value that has a dedicated
   * Reproduction-module recorder (breeding/pregnancy/heat/dry-off) fires this instead of writing
   * a raw status PATCH, so the real dated record (and its downstream sync — Reproduction
   * dashboard, heat-detection list, lactation curve) is what actually gets created. The caller
   * (`CattleTable`) owns mounting the four target dialogs. Omitted entirely by create-mode
   * callers (e.g. the category-highlight tiles) since the Status section never renders there. */
  onRequestReproductionAction?: (
    action: "breeding" | "pregnancy" | "heat" | "dryoff",
    cattle: CattleDetail,
  ) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Mounted only while open, keyed per target cattle — gives `useForm`'s `defaultValues`
          and the local photo `useState`s a genuinely fresh mount on every open (no stale state
          from a previous edit target) without an imperative reset-on-open effect, which would
          trip the `set-state-in-effect` cascading-render lint rule since this outer component
          itself never unmounts (the parent keeps it mounted regardless of `open`). */}
      {open ? (
        <CattleFormDialogBody
          key={cattle?.id ?? "create"}
          onOpenChange={onOpenChange}
          cattle={cattle}
          initialValues={initialValues}
          onRequestReproductionAction={onRequestReproductionAction}
        />
      ) : null}
    </Dialog>
  );
}

function CattleFormDialogBody({
  onOpenChange,
  cattle,
  initialValues,
  onRequestReproductionAction,
}: {
  onOpenChange: (open: boolean) => void;
  cattle?: CattleDetail;
  initialValues?: Partial<CattleEditFormInput>;
  onRequestReproductionAction?: (
    action: "breeding" | "pregnancy" | "heat" | "dryoff",
    cattle: CattleDetail,
  ) => void;
}) {
  const t = useTranslations("cattle.form");
  const tCategory = useTranslations("cattle.animalCategory");
  /** RAKHAL-319-F — reuses the reproduction module's already-translated `breedingMethodValue.*`
   * labels rather than duplicating them (same reasoning as `tCategory` above reusing
   * `cattle.animalCategory.*` for the create-mode preview badge). */
  const tBreedingMethod = useTranslations("reproduction.dialogs.breeding");
  /** Status section (edit-mode only) reuses the former `CattleStatusDialog`'s own i18n namespace
   * verbatim — field labels/options didn't move, only the dialog they lived in did. */
  const tStatus = useTranslations("cattle.statusDialog");
  const isEdit = Boolean(cattle);

  const breeds = useBreeds();
  const sheds = useSheds();
  const feedGroups = useFeedGroups();
  const createCattle = useCreateCattle();
  const updateCattle = useUpdateCattle();
  const setPhoto = useSetCattlePhoto();
  const removePhotoMutation = useRemoveCattlePhoto();
  const updateStatus = useUpdateCattleStatus();
  const createPurchasedLactation = useCreatePurchasedLactation();

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [clearExistingPhoto, setClearExistingPhoto] = useState(false);
  const [addBreedOpen, setAddBreedOpen] = useState(false);
  // RAKHAL-status-fold: ported from `CattleStatusDialog` as-is — toggles the exact
  // `lactationStartDate` path vs the estimated-intake path when setting MILKING on a cow with no
  // active lactation.
  const [useEstimatedIntake, setUseEstimatedIntake] = useState(false);

  const form = useForm<CattleEditFormInput>({
    resolver: zodResolver(cattleEditFormSchema),
    defaultValues: toFormDefaults(cattle, initialValues),
  });

  // RAKHAL-297: recompute the create-mode category preview as gender/DOB/priorCalvings change —
  // `useWatch` (not `form.watch`) so only this subscription re-renders, not the whole form.
  const watchedGender = useWatch({ control: form.control, name: "gender" });
  const watchedDob = useWatch({ control: form.control, name: "dateOfBirth" });
  const watchedPriorCalvings = useWatch({ control: form.control, name: "priorCalvings" });
  const watchedIntakeMode = useWatch({ control: form.control, name: "intakeReproductionMode" }) ?? "none";
  const previewCategory: AnimalCategory | null = isEdit
    ? null
    : deriveAnimalCategoryPreview({
        gender: watchedGender,
        dateOfBirth: watchedDob,
        priorCalvings: watchedPriorCalvings,
      });

  // RAKHAL-status-fold: ported from `CattleStatusDialog` as-is.
  const watchedProductionStatus = useWatch({ control: form.control, name: "productionStatus" });
  const watchedStatusPriorCalvings = useWatch({ control: form.control, name: "statusPriorCalvings" });
  const needsLactationStartDate =
    isEdit && watchedProductionStatus === "MILKING" && cattle?.lactationStage === null;
  const needsPriorCalvings =
    needsLactationStartDate && !useEstimatedIntake && cattle?.animalCategory === "HEIFER";
  const hasCalvedBefore = watchedStatusPriorCalvings !== undefined;

  const pending =
    createCattle.isPending ||
    updateCattle.isPending ||
    setPhoto.isPending ||
    removePhotoMutation.isPending ||
    updateStatus.isPending ||
    createPurchasedLactation.isPending;
  const displayedPhotoUrl =
    photoPreviewUrl ??
    (!clearExistingPhoto ? (cattle?.profile_photo?.thumb_url ?? null) : null);

  function handlePhotoPick(file: File) {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
    setClearExistingPhoto(false);
  }

  function handlePhotoClear() {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setClearExistingPhoto(true);
  }

  async function onSubmit(values: CattleEditFormInput) {
    if (!isEdit && values.intakeReproductionMode === "bred" && !values.intakeBreedingDate) {
      form.setError("intakeBreedingDate", { message: t("intake.breedingDateRequired") });
      return;
    }
    if (!isEdit && values.intakeReproductionMode === "heat" && !values.intakeHeatDateTime) {
      form.setError("intakeHeatDateTime", { message: t("intake.heatDateRequired") });
      return;
    }
    // RAKHAL-status-fold: same required-field guards `CattleStatusDialog.onSubmit` had, run before
    // anything hits the wire so a status validation failure never leaves the basic-info save as a
    // silent partial success.
    if (isEdit && needsLactationStartDate && !useEstimatedIntake && !values.lactationStartDate) {
      form.setError("lactationStartDate", { message: tStatus("lactationStartDateRequired") });
      return;
    }
    if (isEdit && needsPriorCalvings && !values.statusPriorCalvings) {
      form.setError("statusPriorCalvings", { message: tStatus("priorCalvingsRequired") });
      return;
    }
    const payload = toPayload(values, isEdit);
    try {
      const savedId =
        isEdit && cattle
          ? (await updateCattle.mutateAsync({ id: cattle.id, dto: payload })).id
          : (await createCattle.mutateAsync(payload)).id;
      try {
        if (photoFile) {
          await setPhoto.mutateAsync({ id: savedId, file: photoFile });
        } else if (isEdit && clearExistingPhoto && cattle?.profile_photo) {
          await removePhotoMutation.mutateAsync(savedId);
        }
      } catch (photoErr) {
        toast.error(
          photoErr instanceof ApiError
            ? photoErr.message
            : t("photoGenericError"),
        );
      }
      // RAKHAL-status-fold: former `CattleStatusDialog.onSubmit` branching, ported as-is —
      // estimated-intake path creates the Lactation via a separate endpoint, then a follow-up
      // status PATCH only if reproductiveStatus also changed; otherwise a single status PATCH,
      // only fired when production/reproductive status actually changed (avoids a no-op write).
      if (isEdit && cattle) {
        if (needsLactationStartDate && useEstimatedIntake) {
          await createPurchasedLactation.mutateAsync({
            id: cattle.id,
            dto: {
              estimatedCalvingDate: values.estimatedCalvingDate || undefined,
              estimatedDaysInMilk: values.estimatedDaysInMilk,
              estimatedLactationNumber: values.estimatedLactationNumber,
            },
          });
          if (values.reproductiveStatus && values.reproductiveStatus !== cattle.reproductiveStatus) {
            await updateStatus.mutateAsync({
              id: cattle.id,
              dto: { reproductiveStatus: values.reproductiveStatus },
            });
          }
        } else {
          const statusChanged =
            (values.productionStatus ?? undefined) !== (cattle.productionStatus ?? undefined) ||
            (values.reproductiveStatus ?? undefined) !== (cattle.reproductiveStatus ?? undefined);
          if (statusChanged) {
            await updateStatus.mutateAsync({
              id: cattle.id,
              dto: {
                productionStatus: values.productionStatus,
                reproductiveStatus: values.reproductiveStatus,
                lactationStartDate: values.lactationStartDate,
                priorCalvings: values.statusPriorCalvings,
              },
            });
          }
        }
      }
      toast.success(isEdit ? t("updatedToast") : t("createdToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <>
    <DialogContent className="flex max-h-[90vh] w-full max-w-[680px] flex-col gap-0 overflow-hidden rounded-[20px] border-2 border-border p-0 shadow-2xl">
      <div className="flex items-center justify-between px-6 py-5">
        <DialogTitle className="text-xl font-bold text-foreground">
          {isEdit ? t("editTitle") : t("createTitle")}
        </DialogTitle>
      </div>
      <div className="border-t border-border" />

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="flex min-h-0 flex-1 flex-col"
      >
        {/* `min-h-0 flex-1` pins the footer to the bottom — without it this div sizes to its
            content and the outer Sheet/Dialog's own `overflow-y-auto` scrolls header+form+footer
            as one unit instead of just this middle section. */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-4 py-2.5 text-sm font-semibold text-foreground">
            <Sparkles className="size-4 text-primary" aria-hidden />
            {t("basicInfo")}
          </div>

          <div className="flex gap-4">
            <PhotoDropzone
              previewUrl={displayedPhotoUrl}
              onPick={handlePhotoPick}
              onClear={handlePhotoClear}
              label={t("addCowImage")}
            />
            <div className="grid flex-1 grid-cols-2 gap-3">
              <LabeledInput
                id="name"
                label={t("cowName")}
                className="col-span-2"
                {...form.register("name")}
              />
              <LabeledInput
                id="tagNumber"
                label={t("tagNumber")}
                error={form.formState.errors.tagNumber?.message}
                {...form.register("tagNumber")}
              />
              <Controller
                control={form.control}
                name="breedId"
                render={({ field }) => (
                  <Select
                    value={field.value || UNSET}
                    onValueChange={(v) => {
                      if (v === ADD_NEW_BREED) {
                        setAddBreedOpen(true);
                        return;
                      }
                      field.onChange(v);
                    }}
                  >
                    <LabeledSelectTrigger
                      label={t("breed")}
                      placeholder={t("unassigned")}
                    />
                    <SelectContent>
                      <SelectItem value={UNSET}>{t("unassigned")}</SelectItem>
                      {(breeds.data?.items ?? []).map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                      <SelectItem value={ADD_NEW_BREED} className="text-primary">
                        <span className="flex items-center gap-1.5">
                          <Plus className="size-3.5" aria-hidden />
                          {t("addBreed")}
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <Controller
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <LabeledSelectTrigger label={t("gender")} />
                    <SelectContent>
                      {GENDERS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {t(`genderOptions.${g}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <Controller
                control={form.control}
                name="shedId"
                render={({ field }) => (
                  <Select
                    value={field.value || UNSET}
                    onValueChange={field.onChange}
                  >
                    <LabeledSelectTrigger
                      label={t("shed")}
                      placeholder={t("unassigned")}
                    />
                    <SelectContent>
                      <SelectItem value={UNSET}>{t("unassigned")}</SelectItem>
                      {(sheds.data?.items ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <Controller
                control={form.control}
                name="dateOfBirth"
                render={({ field, fieldState }) => (
                  <DatePicker
                    id="dateOfBirth"
                    label={t("dateOfBirth")}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                    disabledDates={{ after: new Date() }}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="purpose"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <LabeledSelectTrigger label={t("purpose")} />
                    <SelectContent>
                      {PURPOSES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {t(`purposeOptions.${p}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {/* RAKHAL-297: only meaningful for a female (a purchased already-calved cow needs
                  this so she lands as `COW` not `HEIFER` on create) — hidden entirely for
                  MALE/CASTRATED_MALE rather than disabled, since it has no effect for them. */}
              {watchedGender === "FEMALE" ? (
                <div className="col-span-2 flex flex-col gap-1.5">
                  <LabeledInput
                    id="priorCalvings"
                    type="number"
                    min={1}
                    step={1}
                    label={t("priorCalvings")}
                    error={form.formState.errors.priorCalvings?.message}
                    {...form.register("priorCalvings", {
                      setValueAs: (v) => (v === "" ? undefined : Number(v)),
                    })}
                  />
                  <p className="text-muted-foreground text-xs">{t("priorCalvingsHint")}</p>
                </div>
              ) : null}
            </div>
          </div>

          {/* RAKHAL-297: create-mode live preview of the derived `AnimalCategory` (UI-mirror only,
              see `animal-category-preview.ts` doc comment) — on the edit path this shows the real
              server-provided `cattle.animalCategory` instead of guessing from form state. */}
          {previewCategory ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {t("willBeAddedAs")}
              <Chip variant={ANIMAL_CATEGORY_VARIANT[previewCategory]}>
                {tCategory(previewCategory)}
              </Chip>
            </div>
          ) : isEdit && cattle ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {t("currentCategory")}
              <Chip variant={ANIMAL_CATEGORY_VARIANT[cattle.animalCategory]}>
                {tCategory(cattle.animalCategory)}
              </Chip>
            </div>
          ) : null}

          {/* RAKHAL-status-fold: former `CattleStatusDialog`, folded into Edit Animal so status is
              changeable from the same modal instead of a separate row action — ported verbatim
              (fields, conditional lactation-start-date/estimated-intake/prior-calvings sub-forms),
              edit-mode only (a not-yet-created animal has no status to change). */}
          {isEdit ? (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-4 py-2.5 text-sm font-semibold text-foreground">
                <Sparkles className="size-4 text-primary" aria-hidden />
                {t("statusSectionTitle")}
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>{tStatus("productionStatus")}</Label>
                  <Controller
                    control={form.control}
                    name="productionStatus"
                    render={({ field }) => (
                      <Select
                        value={field.value ?? UNSET}
                        onValueChange={(v) => {
                          // RAKHAL-status-fold-p4: DRY has a dedicated recorder (closes the
                          // Lactation, opens a DryPeriod, projects the next expected end date) —
                          // a raw status PATCH here would only flip the flag, leaving the rest of
                          // the app blind to it. Redirect instead of writing the field.
                          if (v === "DRY" && cattle) {
                            onRequestReproductionAction?.("dryoff", cattle);
                            onOpenChange(false);
                            return;
                          }
                          field.onChange(v === UNSET ? undefined : v);
                        }}
                      >
                        <LabeledSelectTrigger
                          label={tStatus("productionStatus")}
                          placeholder={tStatus("unassigned")}
                        />
                        <SelectContent>
                          <SelectItem value={UNSET}>{tStatus("unassigned")}</SelectItem>
                          {PRODUCTION_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {tStatus(`productionOptions.${s}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{tStatus("reproductiveStatus")}</Label>
                  <Controller
                    control={form.control}
                    name="reproductiveStatus"
                    render={({ field }) => (
                      <Select
                        value={field.value ?? UNSET}
                        onValueChange={(v) => {
                          // RAKHAL-status-fold-p4: BRED_AWAITING_CONFIRMATION/PREGNANT/OPEN
                          // (heat detected) each have a dedicated recorder that captures the real
                          // date and writes the record the rest of the app (Reproduction
                          // dashboard, heat-detection list, lactation curve) actually reads from —
                          // a raw status PATCH would silently diverge from that. NOT_ELIGIBLE and
                          // POSTPARTUM_WAITING have no companion record, so they stay plain picks.
                          const REDIRECT: Partial<Record<string, "breeding" | "pregnancy" | "heat">> = {
                            BRED_AWAITING_CONFIRMATION: "breeding",
                            PREGNANT: "pregnancy",
                            OPEN: "heat",
                          };
                          const action = REDIRECT[v];
                          if (action && cattle) {
                            onRequestReproductionAction?.(action, cattle);
                            onOpenChange(false);
                            return;
                          }
                          field.onChange(v === UNSET ? undefined : v);
                        }}
                      >
                        <LabeledSelectTrigger
                          label={tStatus("reproductiveStatus")}
                          placeholder={tStatus("unassigned")}
                        />
                        <SelectContent>
                          <SelectItem value={UNSET}>{tStatus("unassigned")}</SelectItem>
                          {REPRODUCTIVE_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {tStatus(`reproductiveOptions.${s}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                {needsLactationStartDate && (
                  <>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={useEstimatedIntake}
                        onCheckedChange={(v) => setUseEstimatedIntake(v === true)}
                      />
                      {tStatus("useEstimatedIntake")}
                    </label>
                    {useEstimatedIntake ? (
                      <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                        <p className="text-muted-foreground text-xs">{tStatus("estimatedIntakeHint")}</p>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="estimatedCalvingDate">{tStatus("estimatedCalvingDate")}</Label>
                          <Input
                            id="estimatedCalvingDate"
                            type="date"
                            {...form.register("estimatedCalvingDate")}
                            aria-label={tStatus("estimatedCalvingDate")}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="estimatedDaysInMilk">{tStatus("estimatedDaysInMilk")}</Label>
                          <Input
                            id="estimatedDaysInMilk"
                            type="number"
                            min={0}
                            step={1}
                            {...form.register("estimatedDaysInMilk", {
                              setValueAs: (v) => (v === "" ? undefined : Number(v)),
                            })}
                            aria-label={tStatus("estimatedDaysInMilk")}
                          />
                          {form.formState.errors.estimatedDaysInMilk && (
                            <p className="text-destructive text-xs">
                              {form.formState.errors.estimatedDaysInMilk.message}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="estimatedLactationNumber">{tStatus("estimatedLactationNumber")}</Label>
                          <Input
                            id="estimatedLactationNumber"
                            type="number"
                            min={1}
                            step={1}
                            {...form.register("estimatedLactationNumber", {
                              setValueAs: (v) => (v === "" ? undefined : Number(v)),
                            })}
                            aria-label={tStatus("estimatedLactationNumber")}
                          />
                          {form.formState.errors.estimatedLactationNumber && (
                            <p className="text-destructive text-xs">
                              {form.formState.errors.estimatedLactationNumber.message}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <Label>{tStatus("lactationStartDate")}</Label>
                        <Input
                          type="date"
                          {...form.register("lactationStartDate")}
                          aria-label={tStatus("lactationStartDate")}
                        />
                        <p className="text-muted-foreground text-xs">{tStatus("lactationStartDateHint")}</p>
                        {form.formState.errors.lactationStartDate && (
                          <p className="text-destructive text-xs">
                            {form.formState.errors.lactationStartDate.message}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
                {needsPriorCalvings && (
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={hasCalvedBefore}
                        onCheckedChange={(v) =>
                          form.setValue("statusPriorCalvings", v === true ? 1 : undefined, {
                            shouldValidate: true,
                          })
                        }
                      />
                      {tStatus("hasCalvedBefore")}
                    </label>
                    {hasCalvedBefore && (
                      <>
                        <Label htmlFor="statusPriorCalvings">{tStatus("priorCalvings")}</Label>
                        <Input
                          id="statusPriorCalvings"
                          type="number"
                          min={1}
                          step={1}
                          {...form.register("statusPriorCalvings", { valueAsNumber: true })}
                          aria-label={tStatus("priorCalvings")}
                        />
                      </>
                    )}
                    {form.formState.errors.statusPriorCalvings && (
                      <p className="text-destructive text-xs">
                        {form.formState.errors.statusPriorCalvings.message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : null}

          {/* RAKHAL-319-F — create-mode-only, female-only intake declarations (`IntakeBreedingDto`/
              `IntakeHeatDto`). Mutually exclusive via a 3-way toggle (none/bred/heat) rather than
              two independent checkboxes — a cow can't be both freshly bred and currently in heat. */}
          {!isEdit && watchedGender === "FEMALE" ? (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-4 py-2.5 text-sm font-semibold text-foreground">
                <Sparkles className="size-4 text-primary" aria-hidden />
                {t("intake.title")}
              </div>
              <div className="flex flex-col gap-3">
                <Controller
                  control={form.control}
                  name="intakeReproductionMode"
                  render={({ field }) => (
                    <Select value={field.value ?? "none"} onValueChange={field.onChange}>
                      <LabeledSelectTrigger label={t("intake.mode")} />
                      <SelectContent>
                        <SelectItem value="none">{t("intake.modeOptions.none")}</SelectItem>
                        <SelectItem value="bred">{t("intake.modeOptions.bred")}</SelectItem>
                        <SelectItem value="heat">{t("intake.modeOptions.heat")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {watchedIntakeMode === "bred" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label>{t("intake.breedingDate")}</Label>
                      <Input
                        type="datetime-local"
                        {...form.register("intakeBreedingDate")}
                      />
                      {form.formState.errors.intakeBreedingDate ? (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.intakeBreedingDate.message}
                        </p>
                      ) : null}
                    </div>
                    <Controller
                      control={form.control}
                      name="intakeBreedingMethod"
                      render={({ field }) => (
                        <Select value={field.value ?? "AI"} onValueChange={field.onChange}>
                          <LabeledSelectTrigger label={tBreedingMethod("breedingMethod")} />
                          <SelectContent>
                            {BREEDING_METHODS.map((v) => (
                              <SelectItem key={v} value={v}>
                                {tBreedingMethod(`breedingMethodValue.${v}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <div className="col-span-2 flex flex-col gap-1.5">
                      <Label htmlFor="intakeBreedingNotes">{t("intake.notes")}</Label>
                      <Textarea id="intakeBreedingNotes" {...form.register("intakeBreedingNotes")} />
                    </div>
                  </div>
                ) : null}
                {watchedIntakeMode === "heat" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 flex flex-col gap-1.5">
                      <Label>{t("intake.heatDateTime")}</Label>
                      <Input type="datetime-local" {...form.register("intakeHeatDateTime")} />
                      {form.formState.errors.intakeHeatDateTime ? (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.intakeHeatDateTime.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="col-span-2 flex flex-col gap-1.5">
                      <Label htmlFor="intakeHeatNotes">{t("intake.notes")}</Label>
                      <Textarea id="intakeHeatNotes" {...form.register("intakeHeatNotes")} />
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {/* Not pictured in Figma (only "Basic Info" is designed) — same visual language,
                covers the remaining CreateCattleDto fields per PRD §8 rather than dropping them. */}
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-4 py-2.5 text-sm font-semibold text-foreground">
            <Info className="size-4 text-primary" aria-hidden />
            {t("additionalInfo")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Controller
              control={form.control}
              name="feedGroupId"
              render={({ field }) => (
                <Select
                  value={field.value || UNSET}
                  onValueChange={field.onChange}
                >
                  <LabeledSelectTrigger
                    label={t("feedGroup")}
                    placeholder={t("unassigned")}
                  />
                  <SelectContent>
                    <SelectItem value={UNSET}>{t("unassigned")}</SelectItem>
                    {(feedGroups.data ?? []).map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <Controller
              control={form.control}
              name="sourceType"
              render={({ field }) => (
                <Select
                  value={field.value || UNSET}
                  onValueChange={field.onChange}
                >
                  <LabeledSelectTrigger
                    label={t("sourceType")}
                    placeholder={t("unassigned")}
                  />
                  <SelectContent>
                    <SelectItem value={UNSET}>{t("unassigned")}</SelectItem>
                    {SOURCE_TYPES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`sourceTypeOptions.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <div className="flex flex-col gap-1.5">
              <Label>{t("mother")}</Label>
              <Controller
                control={form.control}
                name="motherId"
                render={({ field }) => (
                  <CattlePicker
                    value={field.value === UNSET ? undefined : field.value}
                    onValueChange={(id) => field.onChange(id)}
                    placeholder={t("unassigned")}
                  />
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("father")}</Label>
              <Controller
                control={form.control}
                name="fatherId"
                render={({ field }) => (
                  <CattlePicker
                    value={field.value === UNSET ? undefined : field.value}
                    onValueChange={(id) => field.onChange(id)}
                    placeholder={t("unassigned")}
                  />
                )}
              />
            </div>
            <LabeledInput
              id="color"
              label={t("color")}
              {...form.register("color")}
            />
            <LabeledInput
              id="weightKg"
              type="number"
              step="0.1"
              min={0}
              max={2000}
              label={t("weightKg")}
              {...form.register("weightKg", {
                setValueAs: (v) => (v === "" ? undefined : Number(v)),
              })}
            />
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="notes">{t("notes")}</Label>
              <Textarea id="notes" {...form.register("notes")} />
            </div>
          </div>
        </div>

        <div className="border-t border-border" />
        <div className="flex gap-3 px-6 py-5">
          <Button
            type="button"
            variant="secondary"
            className="h-12 flex-1"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {t("cancel")}
          </Button>
          <Button type="submit" className="h-12 flex-1" disabled={pending}>
            {pending ? "…" : t("save")}
          </Button>
        </div>
      </form>
    </DialogContent>
    <AddBreedDialog
      open={addBreedOpen}
      onOpenChange={setAddBreedOpen}
      onCreated={(id) => form.setValue("breedId", id, { shouldValidate: true })}
    />
    </>
  );
}

function AddBreedDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (breedId: string) => void;
}) {
  const t = useTranslations("cattle.form");
  const createBreed = useCreateBreed();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function handleCreate() {
    if (!name.trim()) return;
    try {
      const breed = await createBreed.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onCreated(breed.id);
      setName("");
      setDescription("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t("addBreedTitle")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <LabeledInput
            id="new-breed-name"
            label={t("breedNameLabel")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <LabeledInput
            id="new-breed-description"
            label={t("breedDescriptionLabel")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={handleCreate}
            disabled={createBreed.isPending || !name.trim()}
          >
            {createBreed.isPending ? "…" : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
