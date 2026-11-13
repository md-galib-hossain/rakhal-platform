"use client"; // form state, staged photo, dirty guard, mutation

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { ArrowLeft, X } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LabeledInput } from "@/components/ui/labeled-field";
import { Label } from "@rakhal/ui/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@rakhal/ui/ui/textarea";
import { useUpdateCattle } from "../../../hooks/use-cattle";
import { cattleEditFormSchema, type CattleEditFormInput } from "../../../schemas";
import type { CattleDetail } from "../../../types";
import {
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
} from "../../profile-form/profile-form-shared";
import { WS_CARD } from "../workspace-grid";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={cn(WS_CARD, "flex flex-col gap-4 sm:p-6")}>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Edit profile drawer (RFE-181, 06 §modal rebuild): a 720px right drawer nested over the Animal Workspace — same Sheet,
 * backdrop, card and sticky-footer style as the 600px event drawer, full screen below 640px. Three cards: Identity
 * (photo, name, tag, breed, gender, birth date, shed), Origin & family (source, mother, father), Physical (color, notes).
 * Weight is not here: it is a Weighed event. Reuses the Add-animal dialog's schema, payload builder and field controls
 * (`profile-form/profile-form-shared`). Esc, backdrop, X and Cancel ask before discarding typed changes.
 */
export function ProfileDrawer({ cattle, onClose }: { cattle: CattleDetail; onClose: () => void }) {
  const t = useTranslations("cattle.profile");
  const tForm = useTranslations("cattle.form");
  const update = useUpdateCattle();
  const photo = useStagedPhoto(cattle);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const keepRef = useRef<HTMLDivElement>(null);
  const [confirmExit, setConfirmExit] = useState(false);

  const form = useForm<CattleEditFormInput>({
    resolver: zodResolver(cattleEditFormSchema),
    defaultValues: toFormDefaults(cattle, undefined),
  });
  const dirty = form.formState.isDirty || photo.dirty;
  const pending = update.isPending || photo.pending;

  useEffect(() => {
    if (confirmExit) keepRef.current?.querySelector("button")?.focus();
  }, [confirmExit]);

  function requestClose() {
    if (pending) return;
    if (dirty) setConfirmExit(true);
    else onClose();
  }

  async function onSubmit(values: CattleEditFormInput) {
    // Weight is a Weighed event, never a profile field: do not resend the last weight.
    const payload = { ...toPayload(values), weightKg: undefined };
    try {
      const saved = await update.mutateAsync({ id: cattle.id, dto: payload });
      await photo.commit(saved.id);
      toast.success(t("savedToast"));
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tForm("genericError"));
    }
  }

  const tagError = form.formState.errors.tagNumber ? t("tagRequired") : undefined;

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <SheetContent
        showClose={false}
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
        className="inset-0 z-[60] flex h-dvh w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 shadow-xl sm:left-auto sm:w-[min(720px,100%)] sm:max-w-none sm:rounded-l-[18px] sm:border-l motion-reduce:data-[state=open]:slide-in-from-right-0 motion-reduce:data-[state=closed]:slide-out-to-right-0"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-6">
          <Button type="button" variant="ghost" size="icon" aria-label={t("close")} onClick={requestClose} className="sm:hidden">
            <ArrowLeft className="size-4" aria-hidden />
          </Button>
          <SheetTitle ref={titleRef} tabIndex={-1} className="min-w-0 flex-1 truncate text-base outline-none">
            {t("title", { name: cattle.name ?? cattle.tagNumber })}
          </SheetTitle>
          <Button type="button" variant="ghost" size="icon" aria-label={t("close")} onClick={requestClose} className="max-sm:hidden">
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-muted/30 px-4 py-5 sm:px-6">
            <Section title={t("identity")}>
              <div className="flex gap-4">
                <PhotoDropzone previewUrl={photo.displayedUrl} onPick={photo.pick} onClear={photo.clear} label={tForm("addCowImage")} />
                <div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
                  <LabeledInput id="profile-name" label={tForm("cowName")} {...form.register("name")} />
                  <LabeledInput id="profile-tag" label={tForm("tagNumber")} error={tagError} {...form.register("tagNumber")} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <BreedField form={form} />
                <GenderField form={form} />
                <DobField form={form} />
                <ShedField form={form} />
              </div>
            </Section>

            <Section title={t("origin")}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SourceField form={form} />
                <span className="hidden sm:block" />
                <ParentField form={form} name="motherId" />
                <ParentField form={form} name="fatherId" />
              </div>
            </Section>

            <Section title={t("physical")}>
              <LabeledInput id="profile-color" label={tForm("color")} {...form.register("color")} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-notes">{tForm("notes")}</Label>
                <Textarea id="profile-notes" {...form.register("notes")} />
              </div>
              <p className="text-xs text-muted-foreground">{t("weightHint")}</p>
            </Section>
          </div>

          <div className="flex flex-col gap-2 border-t border-border bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            {confirmExit ? (
              <div role="alert" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-foreground">{t("discardTitle")}</p>
                <div ref={keepRef} className="flex gap-2 sm:justify-end">
                  <Button type="button" variant="outline" className="h-10 flex-1 sm:flex-none" onClick={() => setConfirmExit(false)}>
                    {t("keepEditing")}
                  </Button>
                  <Button type="button" variant="destructive" className="h-10 flex-1 sm:flex-none" onClick={onClose}>
                    {t("discard")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" className="h-10" onClick={requestClose} disabled={pending}>
                  {tForm("cancel")}
                </Button>
                <Button type="submit" className="h-10" disabled={pending}>
                  {pending ? t("saving") : t("save")}
                </Button>
              </div>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
