"use client"; // form state + mutation + staged photo upload

import { useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Chip } from "@/components/ui/chip";
import { LabeledInput } from "@/components/ui/labeled-field";
import { Textarea } from "@rakhal/ui/ui/textarea";
import { Label } from "@rakhal/ui/ui/label";
import { Button } from "@/components/ui/button";
import { useCreateCattle, useUpdateCattle } from "../hooks/use-cattle";
import { cattleEditFormSchema, type CattleEditFormInput } from "../schemas";
import { deriveAnimalCategoryPreview } from "../utils/animal-category-preview";
import { ANIMAL_CATEGORY_VARIANT } from "../utils/animal-category-style";
import type { AnimalCategory, CattleDetail, CattleFormPayload } from "../types";
import { cn } from "@/lib/utils";
import { todayLocalIso } from "@/lib/local-date";
import { HistoryStep } from "./intake-history/history-step";
import { WS_CARD } from "./workspace/workspace-grid";
import { isEmptyHistory, toHistoryPayload, type HistoryValues } from "./intake-history/history-model";
import {
  AnimalGroupField,
  BreedField,
  DobField,
  GenderField,
  ParentField,
  PhotoDropzone,
  ShedField,
  SourceField,
  toFormDefaults,
  toPayload,
  useStagedPhoto,
} from "./profile-form/profile-form-shared";

/**
 * RFE-022 — Add animal (create mode). Editing an existing animal moved into the workspace's own Edit drawer
 * (RFE-181, `workspace/profile/profile-drawer.tsx`); `cattle` is still accepted so other callers keep working, but the
 * workspace no longer uses this dialog for edit. RFE-184: restyled to the Edit drawer's look
 * (720px drawer, WS_CARD sections, sticky footer); the two-step history flow is unchanged. The form controls themselves come from `profile-form/profile-form-shared`.
 *
 * Photo is staged locally and only hits the wire on Save, right after create/update returns a cattle id.
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
  /** RAKHAL-298 — create-mode-only prefill (e.g. the category-highlight tiles' quick-add). Ignored when `cattle` is set. */
  initialValues?: Partial<CattleEditFormInput>;
  /** True while an edit target's `CattleDetail` is still being fetched; renders a skeleton so the body mounts once, in the right mode. */
  loading?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Mounted only while open, keyed per target cattle — a genuinely fresh `useForm` + photo state on every open. */}
      {open && loading ? (
        <CattleFormDialogSkeleton />
      ) : open ? (
        <CattleFormDialogBody key={cattle?.id ?? "create"} onOpenChange={onOpenChange} cattle={cattle} initialValues={initialValues} />
      ) : null}
    </Sheet>
  );
}

/** Same drawer shell as the workspace Edit drawer (RFE-181): 720px right drawer, full screen below 640px. */
const DRAWER_CLASS =
  "inset-0 flex h-dvh w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 shadow-xl sm:left-auto sm:w-[min(720px,100%)] sm:max-w-none sm:rounded-l-[18px] sm:border-l motion-reduce:data-[state=open]:slide-in-from-right-0 motion-reduce:data-[state=closed]:slide-out-to-right-0";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={cn(WS_CARD, "flex flex-col gap-4 sm:p-6")}>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function CattleFormDialogSkeleton() {
  return (
    <SheetContent side="right" aria-describedby={undefined} className={DRAWER_CLASS}>
      <SheetTitle className="sr-only">…</SheetTitle>
      <div className="flex min-h-[460px] flex-1 flex-col gap-4 overflow-y-auto bg-muted/30 px-4 py-5 sm:px-6">
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

  const createCattle = useCreateCattle();
  const updateCattle = useUpdateCattle();
  const photo = useStagedPhoto(cattle);

  // RFE-162: Add animal is two steps — basics, then an optional "her / his history".
  const [createStep, setCreateStep] = useState<"basic" | "history">("basic");
  const [historyValues, setHistoryValues] = useState<HistoryValues>({});
  const today = todayLocalIso();

  const form = useForm<CattleEditFormInput>({
    resolver: zodResolver(cattleEditFormSchema),
    defaultValues: toFormDefaults(cattle, initialValues),
  });

  // RAKHAL-297: recompute the create-mode category preview as gender/DOB/"calved before" change.
  const watchedGender = useWatch({ control: form.control, name: "gender" });
  const watchedDob = useWatch({ control: form.control, name: "dateOfBirth" });
  const previewCategory: AnimalCategory | null = isEdit
    ? null
    : deriveAnimalCategoryPreview({
        gender: watchedGender,
        dateOfBirth: watchedDob,
        priorCalvings: historyValues.calvedBefore === "yes" ? (historyValues.calvingNumber ?? 1) : undefined,
      });

  const pending = createCattle.isPending || updateCattle.isPending || photo.pending;

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
      await photo.commit(savedId);
      toast.success(isEdit ? t("updatedToast") : t("createdToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <SheetContent side="right" aria-describedby={undefined} className={DRAWER_CLASS}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-6">
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
        <SheetTitle className="min-w-0 flex-1 truncate text-base">
          {isEdit ? t("editTitle") : createStep === "history" ? t(watchedGender === "FEMALE" ? "history.titleFemale" : "history.titleMale") : t("createTitle")}
        </SheetTitle>
      </div>

      <form
        onSubmit={form.handleSubmit((values) => onSubmit(values, createStep === "history"))}
        noValidate
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-muted/30 px-4 py-5 sm:px-6", createStep === "history" && "hidden")}>
          <Section title={t("basicInfo")}>
            <div className="flex gap-4">
              <PhotoDropzone previewUrl={photo.displayedUrl} onPick={photo.pick} onClear={photo.clear} label={t("addCowImage")} />
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
                <LabeledInput id="name" label={t("cowName")} {...form.register("name")} />
                <LabeledInput id="tagNumber" label={t("tagNumber")} error={form.formState.errors.tagNumber?.message} {...form.register("tagNumber")} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <BreedField form={form} />
              <GenderField form={form} />
              <ShedField form={form} />
              {!isEdit ? <AnimalGroupField form={form} /> : null}
              <DobField form={form} />
            </div>

            {/* RAKHAL-297: create-mode live preview of the derived `AnimalCategory`. */}
            {previewCategory ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {t("willBeAddedAs")}
                <Chip variant={ANIMAL_CATEGORY_VARIANT[previewCategory]}>{tCategory(previewCategory)}</Chip>
              </div>
            ) : isEdit && cattle ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {t("currentCategory")}
                <Chip variant={ANIMAL_CATEGORY_VARIANT[cattle.animalCategory]}>{tCategory(cattle.animalCategory)}</Chip>
              </div>
            ) : null}
          </Section>

          <Section title={t("additionalInfo")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ParentField form={form} name="motherId" />
              <ParentField form={form} name="fatherId" />
              <SourceField form={form} />
              <LabeledInput id="color" label={t("color")} {...form.register("color")} />
              <LabeledInput
                id="weightKg"
                type="number"
                step="0.1"
                min={0}
                max={2000}
                label={t("weightKg")}
                {...form.register("weightKg", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
              />
              <div className="col-span-1 flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="notes">{t("notes")}</Label>
                <Textarea id="notes" {...form.register("notes")} />
              </div>
            </div>
          </Section>
        </div>

        {!isEdit && createStep === "history" ? (
          <HistoryStep
            gender={watchedGender}
            values={historyValues}
            onChange={(patch) => setHistoryValues((previous) => ({ ...previous, ...patch }))}
            today={today}
          />
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-border bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end sm:px-6">
          {isEdit ? (
            <>
              <Button type="button" variant="outline" className="h-10" onClick={() => onOpenChange(false)} disabled={pending}>
                {t("cancel")}
              </Button>
              <Button type="submit" className="h-10" disabled={pending}>
                {pending ? "…" : t("save")}
              </Button>
            </>
          ) : createStep === "basic" ? (
            <>
              <Button type="button" variant="outline" className="h-10 flex-1 sm:flex-none" onClick={() => onOpenChange(false)} disabled={pending}>
                {t("cancel")}
              </Button>
              <Button type="button" variant="outline" className="h-10 flex-1 sm:flex-none" onClick={() => void form.handleSubmit((values) => onSubmit(values, false))()} disabled={pending}>
                {pending ? "…" : t("history.saveWithout")}
              </Button>
              <Button type="button" className="h-10 w-full sm:w-auto" onClick={() => void goToHistory()} disabled={pending}>
                {t(watchedGender === "FEMALE" ? "history.nextFemale" : "history.nextMale")}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" className="h-10 flex-1 sm:flex-none" onClick={() => setCreateStep("basic")} disabled={pending}>
                {tCommon("back")}
              </Button>
              <Button type="button" variant="outline" className="h-10 flex-1 sm:flex-none" onClick={() => void form.handleSubmit((values) => onSubmit(values, false))()} disabled={pending}>
                {t("history.skip")}
              </Button>
              <Button type="submit" className="h-10 w-full sm:w-auto" disabled={pending}>
                {pending ? "…" : t("history.save")}
              </Button>
            </>
          )}
        </div>
      </form>
    </SheetContent>
  );
}
