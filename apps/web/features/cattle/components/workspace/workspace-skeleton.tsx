"use client"; // close button handler

import { useTranslations } from "next-intl";
import { ArrowLeft, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { WS_AREA_NEXT, WS_AREA_RAIL, WS_AREA_TIME, WS_CONTAINER, WS_GRID } from "./workspace-grid";

/**
 * Loading state shaped like the real workspace (05 §3.5): header, stats row, tabs, then the same three-column grid, so
 * nothing jumps when the animal arrives. Close is a real button from the first frame.
 */
export function WorkspaceSkeleton({ onClose }: { onClose: () => void }) {
  const t = useTranslations("events.workspace");
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy="true" aria-label={t("loading")}>
      <div className="flex flex-col gap-3 pb-4">
        <div className="flex items-start gap-3">
          <button type="button" onClick={onClose} aria-label={t("back")} className="-ml-1 mt-1 flex size-10 shrink-0 items-center justify-center rounded-md hover:bg-muted sm:hidden">
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          <Skeleton className="size-12 shrink-0 rounded-lg sm:size-16" />
          <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
            <Skeleton className="h-6 w-48 max-w-full" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          <button type="button" onClick={onClose} aria-label={t("close")} className="hidden size-10 shrink-0 items-center justify-center rounded-md hover:bg-muted sm:flex">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-border pt-3 sm:flex">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className={i === 1 || i === 3 ? "hidden h-10 w-24 sm:block" : "h-10 w-24"} />
          ))}
        </div>
      </div>
      <div className="border-t border-border" />
      <div className="flex min-h-0 flex-1 flex-col gap-3 pt-3">
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-24 shrink-0" />
          ))}
        </div>
        <div className={cn(WS_CONTAINER, "min-h-0 flex-1 overflow-y-hidden px-1 pb-4")}>
          <div className={WS_GRID}>
            <div className={WS_AREA_NEXT}>
              <Skeleton className="h-24 w-full" />
            </div>
            <div className={cn(WS_AREA_RAIL, "flex gap-3 @min-[720px]/ws:flex-col")}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 w-[72%] shrink-0 @min-[720px]/ws:w-full" />
              ))}
            </div>
            <div className={cn(WS_AREA_TIME, "flex flex-col gap-3")}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
