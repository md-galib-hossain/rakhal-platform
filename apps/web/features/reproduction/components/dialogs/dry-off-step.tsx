"use client";

import { todayLocalIso } from "@/lib/local-date";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { useRecordDryOff } from "../../hooks/use-reproduction";
import { dryOffSchema, type CreateDryOffInput } from "../../schemas";
import { DryOffFormFields } from "./dry-off-form-fields";

/** Edit Animal wizard step for `productionStatus: DRY` — same fields and mutation as the
 * standalone `DryOffDialog`, rendered as step 2 of the same modal instead of a second popup
 * (RAKHAL-status-fold-p5). */
export function DryOffStep({
  cattleId,
  onBack,
  onDone,
}: {
  cattleId: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("reproduction.dialogs.dryOff");
  const tCommon = useTranslations("common");
  const recordDryOff = useRecordDryOff();
  const form = useForm<CreateDryOffInput>({
    resolver: zodResolver(dryOffSchema),
    defaultValues: { dryOffDate: todayLocalIso() },
  });

  async function onSubmit(values: CreateDryOffInput) {
    try {
      await recordDryOff.mutateAsync({ cattleId, input: values });
      toast.success(t("createdToast"));
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-[460px] flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
        <DryOffFormFields form={form} cattleId={cattleId} />
      </div>
      <div className="border-t border-border" />
      <div className="flex gap-3 px-6 py-5">
        <Button type="button" variant="secondary" className="h-12 flex-1" onClick={onBack} disabled={recordDryOff.isPending}>
          {tCommon("back")}
        </Button>
        <Button type="submit" className="h-12 flex-1" disabled={recordDryOff.isPending}>
          {recordDryOff.isPending ? "…" : tCommon("save")}
        </Button>
      </div>
    </form>
  );
}
