"use client"; // form state + mutation + photo upload

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { FormDialog } from "@/components/shared/form-dialog";
import { FileUpload } from "@/components/shared/file-upload";
import { CattlePicker } from "@/components/shared/cattle-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
const PURPOSES = ["MILK", "BREEDING", "MEAT", "CALF", "BULL_SERVICE", "DUAL_PURPOSE"] as const;
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

function toFormDefaults(cattle: CattleDetail | undefined): Partial<CattleFormInput> {
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

/**
 * RFE-022 — one form for both create and edit (`cattle` present = edit). Photo upload is a
 * separate, immediate-effect action (own `POST/DELETE /cattle/:id/photo` endpoints) shown only
 * once a cattle id exists, i.e. edit mode — a create-then-photo two-step, matching the backend's
 * own two-step contract (RAKHAL-009: upload always targets an existing cattle).
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
  const t = useTranslations("cattle.form");
  const isEdit = Boolean(cattle);

  const breeds = useBreeds();
  const sheds = useSheds();
  const feedGroups = useFeedGroups();
  const createCattle = useCreateCattle();
  const updateCattle = useUpdateCattle();
  const setPhoto = useSetCattlePhoto();
  const removePhoto = useRemoveCattlePhoto();

  const form = useForm<CattleFormInput>({
    resolver: zodResolver(cattleFormSchema),
    defaultValues: toFormDefaults(cattle),
  });

  useEffect(() => {
    if (open) form.reset(toFormDefaults(cattle));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens/target changes, not on every render
  }, [open, cattle]);

  const pending = createCattle.isPending || updateCattle.isPending;

  async function onSubmit(values: CattleFormInput) {
    const payload = toPayload(values);
    try {
      if (isEdit && cattle) {
        await updateCattle.mutateAsync({ id: cattle.id, dto: payload });
        toast.success(t("updatedToast"));
      } else {
        await createCattle.mutateAsync(payload);
        toast.success(t("createdToast"));
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  async function handlePhotoSelected(file: File) {
    if (!cattle) return;
    try {
      await setPhoto.mutateAsync({ id: cattle.id, file });
      toast.success(t("photoUpdatedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  async function handlePhotoRemove() {
    if (!cattle) return;
    try {
      await removePhoto.mutateAsync(cattle.id);
      toast.success(t("photoRemovedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? t("editTitle") : t("createTitle")}
      onSubmit={form.handleSubmit(onSubmit)}
      pending={pending}
      submitLabel={t("save")}
      cancelLabel={t("cancel")}
      className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tagNumber">{t("tagNumber")}</Label>
          <Input id="tagNumber" error={form.formState.errors.tagNumber?.message} {...form.register("tagNumber")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">{t("name")}</Label>
          <Input id="name" {...form.register("name")} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{t("gender")}</Label>
          <Controller
            control={form.control}
            name="gender"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-label={t("gender")}>
                  <SelectValue />
                </SelectTrigger>
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
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t("purpose")}</Label>
          <Controller
            control={form.control}
            name="purpose"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-label={t("purpose")}>
                  <SelectValue />
                </SelectTrigger>
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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dateOfBirth">{t("dateOfBirth")}</Label>
          <Input id="dateOfBirth" type="date" {...form.register("dateOfBirth")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="weightKg">{t("weightKg")}</Label>
          <Input
            id="weightKg"
            type="number"
            step="0.1"
            min={0}
            max={2000}
            {...form.register("weightKg", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{t("breed")}</Label>
          <Controller
            control={form.control}
            name="breedId"
            render={({ field }) => (
              <Select value={field.value || UNSET} onValueChange={field.onChange}>
                <SelectTrigger aria-label={t("breed")}>
                  <SelectValue placeholder={t("unassigned")} />
                </SelectTrigger>
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
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t("shed")}</Label>
          <Controller
            control={form.control}
            name="shedId"
            render={({ field }) => (
              <Select value={field.value || UNSET} onValueChange={field.onChange}>
                <SelectTrigger aria-label={t("shed")}>
                  <SelectValue placeholder={t("unassigned")} />
                </SelectTrigger>
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
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{t("feedGroup")}</Label>
          <Controller
            control={form.control}
            name="feedGroupId"
            render={({ field }) => (
              <Select value={field.value || UNSET} onValueChange={field.onChange}>
                <SelectTrigger aria-label={t("feedGroup")}>
                  <SelectValue placeholder={t("unassigned")} />
                </SelectTrigger>
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
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t("sourceType")}</Label>
          <Controller
            control={form.control}
            name="sourceType"
            render={({ field }) => (
              <Select value={field.value || UNSET} onValueChange={field.onChange}>
                <SelectTrigger aria-label={t("sourceType")}>
                  <SelectValue placeholder={t("unassigned")} />
                </SelectTrigger>
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
        </div>

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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="color">{t("color")}</Label>
          <Input id="color" {...form.register("color")} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">{t("notes")}</Label>
        <Textarea id="notes" {...form.register("notes")} />
      </div>

      {isEdit && cattle ? (
        <div className="flex flex-col gap-1.5 border-t border-border pt-4">
          <Label>{t("photo")}</Label>
          {cattle.profile_photo ? (
            <div className="flex items-center gap-3">
              <Avatar className="size-16">
                <AvatarImage src={cattle.profile_photo.thumb_url} alt="" />
                <AvatarFallback>{(cattle.name ?? cattle.tagNumber).charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <Button type="button" variant="outline" size="sm" onClick={handlePhotoRemove} disabled={removePhoto.isPending}>
                {removePhoto.isPending ? "…" : t("removePhoto")}
              </Button>
            </div>
          ) : (
            <FileUpload
              accept="image/png,image/jpeg,image/webp"
              imagePreview
              disabled={setPhoto.isPending}
              onFileSelected={handlePhotoSelected}
              label={t("photoUploadLabel")}
            />
          )}
        </div>
      ) : null}
    </FormDialog>
  );
}
