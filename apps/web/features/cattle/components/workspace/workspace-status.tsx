"use client"; // retry / close click handlers

import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowLeft, RefreshCw, SearchX, X } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@rakhal/ui/ui/button";

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/**
 * Nothing to show (RFE-170): the animal never loaded. Keeps Close reachable, offers Retry, and gives a 404 its own
 * "not found" wording with a Back action instead of a retry that can never succeed.
 */
export function WorkspaceError({
  notFound,
  retrying,
  onRetry,
  onClose,
}: {
  notFound: boolean;
  retrying: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("events.workspace");
  const Icon = notFound ? SearchX : AlertTriangle;
  return (
    <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-4 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive-tint">
        <Icon className="size-6 text-destructive" aria-hidden />
      </div>
      <p className="max-w-xs text-sm font-medium text-foreground">{notFound ? t("notFound") : t("error")}</p>
      <div className="flex gap-2">
        {notFound ? (
          <Button type="button" variant="outline" className="h-10 gap-1.5" onClick={onClose}>
            <ArrowLeft className="size-4" aria-hidden />
            {t("back")}
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" className="h-10 gap-1.5" onClick={onRetry} disabled={retrying}>
              <RefreshCw className="size-4" aria-hidden />
              {t("retry")}
            </Button>
            <Button type="button" variant="ghost" className="h-10 gap-1.5" onClick={onClose}>
              <X className="size-4" aria-hidden />
              {t("close")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** Shown above the sections when a background refetch failed but the animal is still on screen from the cache. */
export function StaleBanner({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  const t = useTranslations("events.workspace");
  return (
    <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning-tint px-3 py-2 text-sm text-warning">
      <span className="font-medium">{t("stale")}</span>
      <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onRetry} disabled={retrying}>
        {t("retry")}
      </Button>
    </div>
  );
}
