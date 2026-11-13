"use client"; // controlled dialog with two async actions

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/constants/i18n";
import { formatDateTime } from "@/lib/format";
import { Button } from "@rakhal/ui/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { periodLabel } from "../../lib/format";
import { reportStatusKey } from "../../lib/labels";
import type { ReportSummary } from "../../types";
import type { Translate } from "./shared";

interface Props {
  existing: ReportSummary | null;
  pending: boolean;
  errorKey: string | null;
  onOpenExisting: (id: string) => void;
  onGenerateNew: () => void;
  onClose: () => void;
}

export function DuplicateDialog({ existing, pending, errorKey, onOpenExisting, onGenerateNew, onClose }: Props) {
  const t = useTranslations() as unknown as Translate;
  const tw = useTranslations("reportsWizard") as unknown as Translate;
  const locale = useLocale() as Locale;
  return (
    <Dialog open={existing !== null} onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tw("duplicate.title")}</DialogTitle>
          <DialogDescription>{tw("duplicate.body")}</DialogDescription>
        </DialogHeader>
        {existing ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">{tw("duplicate.period")}</dt>
            <dd className="font-medium">{periodLabel(existing.period, locale)}</dd>
            <dt className="text-muted-foreground">{tw("duplicate.generatedAt")}</dt>
            <dd className="font-medium">{formatDateTime(existing.completedAt ?? existing.createdAt, locale)}</dd>
            <dt className="text-muted-foreground">{tw("duplicate.status")}</dt>
            <dd className="font-medium">{t(reportStatusKey(existing.status))}</dd>
          </dl>
        ) : null}
        {errorKey ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {t(errorKey)}
          </p>
        ) : null}
        <DialogFooter className="gap-2">
          <Button type="button" variant="secondary" disabled={pending} onClick={onGenerateNew}>
            {pending ? tw("duplicate.working") : tw("duplicate.generateNew")}
          </Button>
          <Button type="button" disabled={pending} onClick={() => existing && onOpenExisting(existing.id)}>
            {tw("duplicate.openExisting")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
