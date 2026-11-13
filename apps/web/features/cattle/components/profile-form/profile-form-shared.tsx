"use client"; // form controls + staged photo state shared by the Add-animal dialog and the workspace Edit drawer

import { useRef, useState } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { CattlePicker } from "@/components/shared/cattle-picker";
import { CreatableSelect } from "@/components/shared/creatable-select";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@rakhal/ui/ui/label";
import { LabeledInput, LabeledSelectTrigger } from "@/components/ui/labeled-field";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  useAnimalGroups,
  useBreeds,
  useCreateAnimalGroup,
  useCreateBreed,
  useCreateShedInline,
  useRemoveCattlePhoto,
  useSetCattlePhoto,
  useSheds,
} from "../../hooks/use-cattle";
import type { CattleEditFormInput } from "../../schemas";
import type { CattleDetail, CattleFormPayload } from "../../types";

export const UNSET = "__unset__";
const ADD_NEW_BREED = "__add_new_breed__";
export const GENDERS = ["MALE", "FEMALE", "CASTRATED_MALE"] as const;
export const SOURCE_TYPES = ["BORN", "PURCHASED", "GIFTED", "UNKNOWN"] as const;

export type ProfileForm = UseFormReturn<CattleEditFormInput>;

/** Strips the `""`/`UNSET` sentinel back to `undefined` before hitting the API — the backend's
 * optional string fields reject an empty string differently than an omitted key in some paths
 * (`@IsOptional` only skips `undefined`), so never send `""`/sentinel on the wire. */
export function toPayload(values: CattleEditFormInput): CattleFormPayload {
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

export function toFormDefaults(
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
 * picked file is staged here and uploaded right after create/update succeeds. */
export function PhotoDropzone({
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
          <img src={previewUrl} alt="" className="size-full rounded-xl object-cover" />
        ) : (
          <>
            <Plus className="size-5 text-muted-foreground" aria-hidden />
            <span className="px-2 text-xs leading-tight text-muted-foreground">{label}</span>
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

/** Staged photo state: pick/clear locally, upload or remove only once the record is saved (`commit`). */
export function useStagedPhoto(cattle: CattleDetail | undefined) {
  const t = useTranslations("cattle.form");
  const setPhoto = useSetCattlePhoto();
  const removePhoto = useRemoveCattlePhoto();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);

  const displayedUrl = previewUrl ?? (!cleared ? (cattle?.profile_photo?.thumb_url ?? null) : null);

  function pick(next: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    setCleared(false);
  }

  function clear() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setCleared(true);
  }

  /** A photo failure never fails the save: the record is already written, so toast and carry on. */
  async function commit(savedId: string) {
    try {
      if (file) await setPhoto.mutateAsync({ id: savedId, file });
      else if (cleared && cattle?.profile_photo) await removePhoto.mutateAsync(savedId);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("photoGenericError"));
    }
  }

  return {
    displayedUrl,
    pick,
    clear,
    commit,
    dirty: file !== null || cleared,
    pending: setPhoto.isPending || removePhoto.isPending,
  };
}

export function BreedField({ form }: { form: ProfileForm }) {
  const t = useTranslations("cattle.form");
  const breeds = useBreeds();
  const [addOpen, setAddOpen] = useState(false);
  return (
    <>
      <Controller
        control={form.control}
        name="breedId"
        render={({ field }) => (
          <Select
            value={field.value || UNSET}
            onValueChange={(v) => {
              if (v === ADD_NEW_BREED) {
                setAddOpen(true);
                return;
              }
              field.onChange(v);
            }}
          >
            <LabeledSelectTrigger label={t("breed")} placeholder={t("unassigned")} />
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
      <AddBreedDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(id) => form.setValue("breedId", id, { shouldValidate: true, shouldDirty: true })}
      />
    </>
  );
}

export function GenderField({ form }: { form: ProfileForm }) {
  const t = useTranslations("cattle.form");
  return (
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
  );
}

export function ShedField({ form }: { form: ProfileForm }) {
  const t = useTranslations("cattle.form");
  const sheds = useSheds();
  const createShed = useCreateShedInline();
  return (
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
          onCreate={(name) => createShed.mutateAsync(name)}
        />
      )}
    />
  );
}

export function AnimalGroupField({ form }: { form: ProfileForm }) {
  const t = useTranslations("cattle.form");
  const groups = useAnimalGroups();
  const createGroup = useCreateAnimalGroup();
  return (
    <Controller
      control={form.control}
      name="animalGroupId"
      render={({ field }) => (
        <CreatableSelect
          value={field.value || UNSET}
          onValueChange={field.onChange}
          options={groups.data?.items ?? []}
          trigger={<LabeledSelectTrigger label={t("animalGroup")} placeholder={t("unassigned")} />}
          extraItems={<SelectItem value={UNSET}>{t("unassigned")}</SelectItem>}
          createLabel={t("addGroup")}
          namePlaceholder={t("groupNamePlaceholder")}
          createErrorMessage={t("addGroupError")}
          onCreate={(name) => createGroup.mutateAsync({ name })}
        />
      )}
    />
  );
}

export function DobField({ form }: { form: ProfileForm }) {
  const t = useTranslations("cattle.form");
  return (
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
  );
}

export function ParentField({ form, name }: { form: ProfileForm; name: "motherId" | "fatherId" }) {
  const t = useTranslations("cattle.form");
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{t(name === "motherId" ? "mother" : "father")}</Label>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <CattlePicker
            value={field.value === UNSET ? undefined : field.value}
            onValueChange={(id) => field.onChange(id)}
            placeholder={t("unassigned")}
          />
        )}
      />
    </div>
  );
}

export function SourceField({ form }: { form: ProfileForm }) {
  const t = useTranslations("cattle.form");
  return (
    <Controller
      control={form.control}
      name="sourceType"
      render={({ field }) => (
        <Select value={field.value || UNSET} onValueChange={field.onChange}>
          <LabeledSelectTrigger label={t("sourceType")} placeholder={t("unassigned")} />
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
      <SheetContent
        side="right"
        className="z-[70] inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-[420px]"
      >
        <SheetHeader>
          <SheetTitle>{t("addBreedTitle")}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 py-2">
          <LabeledInput id="new-breed-name" label={t("breedNameLabel")} value={name} onChange={(e) => setName(e.target.value)} />
          <LabeledInput
            id="new-breed-description"
            label={t("breedDescriptionLabel")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <SheetFooter className="border-t border-dashed border-border pt-4">
          <Button type="button" onClick={handleCreate} disabled={createBreed.isPending || !name.trim()}>
            {createBreed.isPending ? "…" : t("save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
