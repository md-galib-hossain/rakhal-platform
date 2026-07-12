"use client"; // form state + mutation + staged photo upload

import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarDays, Info, Plus, Sparkles, X } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CattlePicker } from "@/components/shared/cattle-picker";
import {
  LabeledInput,
  LabeledSelectTrigger,
} from "@/components/ui/labeled-field";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import {
  useBreeds,
  useCreateCattle,
  useFeedGroups,
  useRemoveCattlePhoto,
  useSetCattlePhoto,
  useSheds,
  useUpdateCattle,
} from "../hooks/use-cattle";
import { cattleFormSchema, type CattleFormInput } from "../schemas";
import type { CattleDetail, CattleFormPayload } from "../types";

const UNSET = "__unset__";

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

/** Strips the `""`/`UNSET` sentinel back to `undefined` before hitting the API — the backend's
 * optional string fields reject an empty string differently than an omitted key in some paths
 * (`@IsOptional` only skips `undefined`), so never send `""`/sentinel on the wire. */
function toPayload(values: CattleFormInput): CattleFormPayload {
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
  };
}

function toFormDefaults(
  cattle: CattleDetail | undefined,
): Partial<CattleFormInput> {
  if (!cattle) return { gender: "FEMALE", purpose: "MILK" };
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cattle?: CattleDetail;
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
        />
      ) : null}
    </Dialog>
  );
}

function CattleFormDialogBody({
  onOpenChange,
  cattle,
}: {
  onOpenChange: (open: boolean) => void;
  cattle?: CattleDetail;
}) {
  const t = useTranslations("cattle.form");
  const isEdit = Boolean(cattle);

  const breeds = useBreeds();
  const sheds = useSheds();
  const feedGroups = useFeedGroups();
  const createCattle = useCreateCattle();
  const updateCattle = useUpdateCattle();
  const setPhoto = useSetCattlePhoto();
  const removePhotoMutation = useRemoveCattlePhoto();

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [clearExistingPhoto, setClearExistingPhoto] = useState(false);

  const form = useForm<CattleFormInput>({
    resolver: zodResolver(cattleFormSchema),
    defaultValues: toFormDefaults(cattle),
  });

  const pending =
    createCattle.isPending ||
    updateCattle.isPending ||
    setPhoto.isPending ||
    removePhotoMutation.isPending;
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

  async function onSubmit(values: CattleFormInput) {
    const payload = toPayload(values);
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
      toast.success(isEdit ? t("updatedToast") : t("createdToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
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
        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
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
                    onValueChange={field.onChange}
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
              <LabeledInput
                id="dateOfBirth"
                type="date"
                label={t("dateOfBirth")}
                endIcon={
                  <CalendarDays
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                }
                {...form.register("dateOfBirth")}
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
            </div>
          </div>

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
  );
}
