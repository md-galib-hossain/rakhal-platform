"use client"; // form state + mutation + staged photo upload

import { useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronLeft, Info, Plus, Sparkles, X } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CattlePicker } from "@/components/shared/cattle-picker";
import { CreatableSelect } from "@/components/shared/creatable-select";
import { Chip } from "@/components/ui/chip";
import {
  LabeledInput,
  LabeledSelectTrigger,
} from "@/components/ui/labeled-field";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import {
  useAnimalGroups,
  useBreeds,
  useCreateAnimalGroup,
  useCreateBreed,
  useCreateCattle,
  useCreateShedInline,
  useRemoveCattlePhoto,
  useSetCattlePhoto,
  useSheds,
  useUpdateCattle,
} from "../hooks/use-cattle";
import { cattleEditFormSchema, type CattleEditFormInput } from "../schemas";
import { deriveAnimalCategoryPreview } from "../utils/animal-category-preview";
import { ANIMAL_CATEGORY_VARIANT } from "../utils/animal-category-style";
import type { AnimalCategory, CattleDetail, CattleFormPayload } from "../types";
import { cn } from "@/lib/utils";
import { todayLocalIso } from "@/lib/local-date";
import { HistoryStep } from "./intake-history/history-step";
import { isEmptyHistory, toHistoryPayload, type HistoryValues } from "./intake-history/history-model";

const UNSET = "__unset__";
const ADD_NEW_BREED = "__add_new_breed__";

const GENDERS = ["MALE", "FEMALE", "CASTRATED_MALE"] as const;
const SOURCE_TYPES = ["BORN", "PURCHASED", "GIFTED", "UNKNOWN"] as const;
/** Strips the `""`/`UNSET` sentinel back to `undefined` before hitting the API — the backend's
 * optional string fields reject an empty string differently than an omitted key in some paths
 * (`@IsOptional` only skips `undefined`), so never send `""`/sentinel on the wire. */
function toPayload(values: CattleEditFormInput): CattleFormPayload {
  const clean = <T,>(v: T | "" | typeof UNSET | undefined): T | undefined =>
    v === "" || v === UNSET || v === undefined ? undefined : v;
  return {
    name: clean(values.name),
    tagNumber: values.tagNumber,
    breedId: clean(values.breedId),
    gender: values.gender,
    dateOfBirth: clean(values.dateOfBirth),
    shedId: clean(values.shedId),
    animalGroupId: clean(values.animalGroupId),
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
  initialValues: Partial<CattleEditFormInput> | undefined,
): Partial<CattleEditFormInput> {
  if (!cattle) return { gender: "FEMALE", ...initialValues };
  return {
    name: cattle.name ?? "",
    tagNumber: cattle.tagNumber,
    breedId: cattle.breed?.id ?? undefined,
    gender: cattle.gender,
    dateOfBirth: cattle.dateOfBirth ? cattle.dateOfBirth.slice(0, 10) : "",
    shedId: cattle.shedId ?? undefined,
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
    <div className="relative size-[116px] shrink-0">
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
 * `CreateCattleDto` fields (source, parents, color, weight, notes) get a second
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
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cattle?: CattleDetail;
  /** RAKHAL-298 — create-mode-only prefill (e.g. the category-highlight tiles' quick-add: Heifer
   * prefills `gender: "FEMALE"`, Calf prefills `purpose: "CALF"` + today's `dateOfBirth`). Ignored
   * when `cattle` is set (edit mode always loads the existing cow's own values). */
  initialValues?: Partial<CattleEditFormInput>;
  /** True while an edit target's `CattleDetail` is still being fetched (caller opens the dialog
   * immediately on row-action click, before the detail query resolves). Without this the body
   * below would mount once with `cattle` still `undefined` (create-mode UI, `key="create"`) and
   * then remount into edit-mode the instant the fetch resolves — a full create→edit UI swap
   * mid-open-animation that reads as a flicker on every cold (uncached) edit click. Renders a
   * skeleton instead so the body only ever mounts once, already in the right mode. */
  loading?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Mounted only while open, keyed per target cattle — gives `useForm`'s `defaultValues`
          and the local photo `useState`s a genuinely fresh mount on every open (no stale state
          from a previous edit target) without an imperative reset-on-open effect, which would
          trip the `set-state-in-effect` cascading-render lint rule since this outer component
          itself never unmounts (the parent keeps it mounted regardless of `open`). */}
      {open && loading ? (
        <CattleFormDialogSkeleton />
      ) : open ? (
        <CattleFormDialogBody
          key={cattle?.id ?? "create"}
          onOpenChange={onOpenChange}
          cattle={cattle}
          initialValues={initialValues}
        />
      ) : null}
    </Sheet>
  );
}

/** Placeholder shown while an edit target's detail is still loading — see `loading` prop above.
 * Roughly matches the real body's header + footer chrome so the dialog doesn't jump size once the
 * real form swaps in. */
function CattleFormDialogSkeleton() {
  return (
    <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 overflow-hidden p-0 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:max-w-[680px]">
      <div className="flex min-h-[460px] flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
        <div className="h-9 w-40 animate-pulse rounded-xl bg-muted" />
        <div className="flex gap-4">
          <div className="size-[116px] shrink-0 animate-pulse rounded-xl bg-muted" />
          <div className="flex flex-1 flex-col justify-between gap-1">
            <div className="h-14 animate-pulse rounded-xl bg-muted" />
            <div className="h-14 animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    </SheetContent>
  );
}

function CattleFormDialogBody({
  onOpenChange,
  cattle,
  initialValues,
}: {
  onOpenChange: (open: boolean) => void;
  cattle?: CattleDetail;
  initialValues?: Partial<CattleEditFormInput>;
}) {
  const t = useTranslations("cattle.form");
  const tCategory = useTranslations("cattle.animalCategory");
  const tCommon = useTranslations("common");
  const isEdit = Boolean(cattle);

  const breeds = useBreeds();
  const sheds = useSheds();
  const animalGroups = useAnimalGroups();
  const createShedInline = useCreateShedInline();
  const createAnimalGroup = useCreateAnimalGroup();
  const createCattle = useCreateCattle();
  const updateCattle = useUpdateCattle();
  const setPhoto = useSetCattlePhoto();
  const removePhotoMutation = useRemoveCattlePhoto();

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [clearExistingPhoto, setClearExistingPhoto] = useState(false);
  const [addBreedOpen, setAddBreedOpen] = useState(false);
  // RFE-162: Add animal is two steps — basics, then an optional "her / his history". Edit profile is identity only.
  const [createStep, setCreateStep] = useState<"basic" | "history">("basic");
  const [historyValues, setHistoryValues] = useState<HistoryValues>({});
  const today = todayLocalIso();

  const form = useForm<CattleEditFormInput>({
    resolver: zodResolver(cattleEditFormSchema),
    defaultValues: toFormDefaults(cattle, initialValues),
  });

  // RAKHAL-297: recompute the create-mode category preview as gender/DOB/"calved before" change —
  // `useWatch` (not `form.watch`) so only this subscription re-renders, not the whole form.
  const watchedGender = useWatch({ control: form.control, name: "gender" });
  const watchedDob = useWatch({ control: form.control, name: "dateOfBirth" });
  const previewCategory: AnimalCategory | null = isEdit
    ? null
    : deriveAnimalCategoryPreview({
        gender: watchedGender,
        dateOfBirth: watchedDob,
        priorCalvings: historyValues.calvedBefore === "yes" ? (historyValues.calvingNumber ?? 1) : undefined,
      });

  const pending =
    createCattle.isPending || updateCattle.isPending || setPhoto.isPending || removePhotoMutation.isPending;
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

  async function goToHistory() {
    if (await form.trigger()) setCreateStep("history");
  }

  /** Create: the "her history" answers go in `history` and become backdated HISTORICAL events server-side. */
  async function createWithHistory(payload: CattleFormPayload, values: CattleEditFormInput, withHistory: boolean): Promise<string> {
    const history = withHistory ? toHistoryPayload(historyValues, values.gender, today) : undefined;
    return (await createCattle.mutateAsync(history ? { ...payload, history } : payload)).id;
  }

  async function onSubmit(values: CattleEditFormInput, withHistory: boolean) {
    const payload = toPayload(values);
    try {
      let savedId: string;
      if (isEdit && cattle) {
        savedId = (await updateCattle.mutateAsync({ id: cattle.id, dto: payload })).id;
      } else {
        savedId = await createWithHistory(payload, values, withHistory && !isEmptyHistory(historyValues, values.gender));
      }
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
    <>
    <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 overflow-hidden p-0 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:max-w-[680px]">
      <div className="flex items-center gap-2 px-6 py-5">
        {createStep === "history" ? (
          <button
            type="button"
            onClick={() => setCreateStep("basic")}
            aria-label={tCommon("back")}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
        ) : null}
        <SheetTitle className="text-xl font-bold text-foreground">
          {isEdit ? t("editTitle") : createStep === "history" ? t(watchedGender === "FEMALE" ? "history.titleFemale" : "history.titleMale") : t("createTitle")}
        </SheetTitle>
      </div>
      <div className="border-t border-border" />

      <form
        onSubmit={form.handleSubmit((values) => onSubmit(values, createStep === "history"))}
        noValidate
        className="flex min-h-0 flex-1 flex-col"
      >
        {/* `min-h-0 flex-1` pins the footer to the bottom — without it this div sizes to its
            content and the outer Sheet/Dialog's own `overflow-y-auto` scrolls header+form+footer
            as one unit instead of just this middle section. `min-h-[460px]` keeps the dialog a
            consistent height whether step 1 (long) or a wizard step (short, e.g. Heat) is
            showing, per the same reasoning as each step's own scroll area. */}
        <div className={cn("flex min-h-[460px] flex-1 flex-col gap-4 overflow-y-auto px-6 py-5", createStep === "history" && "hidden")}>
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
            <div className="flex flex-1 flex-col justify-between gap-1">
              <LabeledInput
                id="name"
                label={t("cowName")}
                {...form.register("name")}
              />
              <LabeledInput
                id="tagNumber"
                label={t("tagNumber")}
                error={form.formState.errors.tagNumber?.message}
                {...form.register("tagNumber")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                <CreatableSelect
                  value={field.value || UNSET}
                  onValueChange={field.onChange}
                  options={sheds.data?.items ?? []}
                  trigger={<LabeledSelectTrigger label={t("shed")} placeholder={t("unassigned")} />}
                  extraItems={<SelectItem value={UNSET}>{t("unassigned")}</SelectItem>}
                  createLabel={t("addShed")}
                  namePlaceholder={t("shedNamePlaceholder")}
                  createErrorMessage={t("addShedError")}
                  onCreate={(name) => createShedInline.mutateAsync(name)}
                />
              )}
            />
            {!isEdit ? (
              <Controller
                control={form.control}
                name="animalGroupId"
                render={({ field }) => (
                  <CreatableSelect
                    value={field.value || UNSET}
                    onValueChange={field.onChange}
                    options={animalGroups.data?.items ?? []}
                    trigger={<LabeledSelectTrigger label={t("animalGroup")} placeholder={t("unassigned")} />}
                    extraItems={<SelectItem value={UNSET}>{t("unassigned")}</SelectItem>}
                    createLabel={t("addGroup")}
                    namePlaceholder={t("groupNamePlaceholder")}
                    createErrorMessage={t("addGroupError")}
                    onCreate={(name) => createAnimalGroup.mutateAsync({ name })}
                  />
                )}
              />
            ) : null}
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

          {/* Not pictured in Figma (only "Basic Info" is designed) — same visual language,
                covers the remaining CreateCattleDto fields per PRD §8 rather than dropping them. */}
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-4 py-2.5 text-sm font-semibold text-foreground">
            <Info className="size-4 text-primary" aria-hidden />
            {t("additionalInfo")}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <div className="col-span-1 flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="notes">{t("notes")}</Label>
              <Textarea id="notes" {...form.register("notes")} />
            </div>
          </div>
        </div>

        {!isEdit && createStep === "history" ? (
          <HistoryStep
            gender={watchedGender}
            values={historyValues}
            onChange={(patch) => setHistoryValues((previous) => ({ ...previous, ...patch }))}
            today={today}
          />
        ) : null}

        <div className="border-t border-border" />
        <div className="flex flex-wrap gap-3 px-6 py-5">
          {isEdit ? (
            <>
              <Button type="button" variant="secondary" className="h-12 flex-1" onClick={() => onOpenChange(false)} disabled={pending}>
                {t("cancel")}
              </Button>
              <Button type="submit" className="h-12 flex-1" disabled={pending}>
                {pending ? "…" : t("save")}
              </Button>
            </>
          ) : createStep === "basic" ? (
            <>
              <Button type="button" variant="secondary" className="h-12 flex-1" onClick={() => onOpenChange(false)} disabled={pending}>
                {t("cancel")}
              </Button>
              <Button type="button" variant="outline" className="h-12 flex-1" onClick={() => void form.handleSubmit((values) => onSubmit(values, false))()} disabled={pending}>
                {pending ? "…" : t("history.saveWithout")}
              </Button>
              <Button type="button" className="h-12 w-full sm:flex-1" onClick={() => void goToHistory()} disabled={pending}>
                {t(watchedGender === "FEMALE" ? "history.nextFemale" : "history.nextMale")}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="secondary" className="h-12 flex-1" onClick={() => setCreateStep("basic")} disabled={pending}>
                {tCommon("back")}
              </Button>
              <Button type="button" variant="outline" className="h-12 flex-1" onClick={() => void form.handleSubmit((values) => onSubmit(values, false))()} disabled={pending}>
                {t("history.skip")}
              </Button>
              <Button type="submit" className="h-12 w-full sm:flex-1" disabled={pending}>
                {pending ? "…" : t("history.save")}
              </Button>
            </>
          )}
        </div>
      </form>
    </SheetContent>
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle>{t("addBreedTitle")}</SheetTitle>
        </SheetHeader>
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
        <SheetFooter className="border-t border-dashed border-border pt-4">
          <Button
            type="button"
            onClick={handleCreate}
            disabled={createBreed.isPending || !name.trim()}
          >
            {createBreed.isPending ? "…" : t("save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
