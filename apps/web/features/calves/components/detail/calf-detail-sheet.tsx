"use client"; // live query + sheet open state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRightToLine } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { DateText } from "@/components/shared/date-text";
import { Can } from "@/lib/auth/permissions";
import { useCalfDetail } from "../../hooks/use-calves";
import { CalfDetailTabs } from "./calf-detail-tabs";
import { WeanCalfDialog } from "../dialogs/wean-calf-dialog";

/**
 * "Calf Details" right-side drawer (RFE-033, no Figma frame) — same floating-card shape as
 * `CattleDetailSheet` (inset 10px, 20px corner radius, 2px border). The only calf detail view (no
 * standalone `/calves/:id` route, `?view=` is the only entry point from day one). No footer
 * Cancel/Edit buttons — there's no calf-level "edit profile" route, only the 5 log actions (inside
 * the tabs) + Wean (in this header, since it ends the calf's membership in this module).
 */
export function CalfDetailSheet({
  calfId,
  onOpenChange,
}: {
  calfId: string | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("calves.detail");
  const query = useCalfDetail(calfId);
  const [weanOpen, setWeanOpen] = useState(false);

  return (
    <Sheet open={Boolean(calfId)} onOpenChange={onOpenChange}>
      <SheetContent
        showClose={false}
        className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[820px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[820px]"
      >
        <div className="flex items-center justify-between pb-5">
          <SheetTitle className="text-xl font-bold text-foreground">{t("title")}</SheetTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t("close")}
            className="flex size-5 items-center justify-center text-foreground transition-opacity hover:opacity-70"
          >
            <ArrowRightToLine className="size-5" aria-hidden />
          </button>
        </div>
        <div className="border-t border-border" />

        <div className="flex-1 overflow-y-auto py-4">
          {query.isLoading ? (
            <CardSkeleton lines={3} />
          ) : query.isError || !query.data ? (
            <ErrorState description={t("error")} onRetry={() => query.refetch()} />
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="flex flex-col gap-1">
                  <p className="text-lg font-bold text-foreground">
                    {query.data.name ?? query.data.tagNumber}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">{query.data.tagNumber}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {query.data.dam?.name ?? query.data.dam?.tagNumber ?? t("noDam")}
                    {" · "}
                    <DateText date={query.data.birthDate} />
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {query.data.weaningStatus === "weaned" ? (
                    <Badge variant="success">{t("weaned")}</Badge>
                  ) : null}
                  <Can I="calf.update">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={query.data.weaningStatus === "weaned"}
                      onClick={() => setWeanOpen(true)}
                    >
                      {t("wean")}
                    </Button>
                  </Can>
                </div>
              </div>
              <CalfDetailTabs calfId={query.data.id} data={query.data} />
            </div>
          )}
        </div>
      </SheetContent>

      {query.data ? (
        <WeanCalfDialog
          calfId={query.data.id}
          open={weanOpen}
          onOpenChange={setWeanOpen}
          onWeaned={() => onOpenChange(false)}
        />
      ) : null}
    </Sheet>
  );
}
