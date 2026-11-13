"use client"; // button handler

import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@rakhal/ui/ui/card";
import { WS_CARD } from "../workspace-grid";
import { CardSkeleton } from "@/components/shared/card-skeleton";

/**
 * Shell shared by the four workspace state cards (RFE-156). Each card owns its query, so one failing card shows its
 * own retry and never takes the sheet down with it (03 §10 "States"). "View" opens the drill panel.
 */
export function StateCard({
  title,
  loading,
  error,
  onRetry,
  onView,
  children,
}: {
  title: string;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onView: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations("events.cards");
  return (
    <Card className={`${WS_CARD} flex flex-col gap-3`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold normal-case tracking-normal text-foreground ">{title}</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-mr-2 h-8 gap-0.5 px-2 text-xs"
          onClick={onView}
          aria-label={`${t("view")}: ${title}`}
        >
          {t("view")}
          <ChevronRight className="size-3.5" aria-hidden />
        </Button>
      </div>
      {loading ? (
        <CardSkeleton lines={2} />
      ) : error ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-destructive">{t("error")}</p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {t("retry")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1 text-sm text-foreground">{children}</div>
      )}
    </Card>
  );
}
