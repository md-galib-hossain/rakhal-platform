"use client"; // menu + dialog state; permission and session reads

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@rakhal/ui/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@rakhal/ui/ui/dropdown-menu";
import { useCan } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/use-session";
import type { TimelineEvent } from "../../../timeline-model";
import { CopyEventDialog } from "./copy-event-dialog";
import { EditEventDialog } from "./edit-event-dialog";
import { canChangeEvent, formKeyForType } from "./permissions";
import { VoidEventDialog } from "./void-event-dialog";

/**
 * The row's `⋯` menu (RFE-161, 03 §3.4): Edit · Void · Copy to another animal. Edit / Void follow the author-24 h /
 * manager rule; Copy needs only `cattle.event` and an event type that has a record form. Renders nothing when it has no
 * item to offer.
 */
export function RowActions({ cattleId, event }: { cattleId: string; event: TimelineEvent }) {
  const t = useTranslations("events.timeline.actions");
  const can = useCan();
  const { data: session } = useSession();
  const [dialog, setDialog] = useState<"edit" | "void" | "copy" | null>(null);

  const canRecord = can("cattle.event");
  const change = canChangeEvent(event, { id: session?.user.id ?? null, canRecord, canVoid: can("cattle.event.void") });
  const copyKey = canRecord && event.status !== "VOIDED" ? formKeyForType(event.type) : null;
  if (!change && !copyKey) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label={t("menu")}>
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {change ? <DropdownMenuItem onSelect={() => setDialog("edit")}>{t("edit")}</DropdownMenuItem> : null}
          {change ? <DropdownMenuItem onSelect={() => setDialog("void")}>{t("void")}</DropdownMenuItem> : null}
          {copyKey ? <DropdownMenuItem onSelect={() => setDialog("copy")}>{t("copy")}</DropdownMenuItem> : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {dialog === "edit" ? <EditEventDialog cattleId={cattleId} event={event} open onOpenChange={(o) => !o && setDialog(null)} /> : null}
      {dialog === "void" ? <VoidEventDialog cattleId={cattleId} event={event} open onOpenChange={(o) => !o && setDialog(null)} /> : null}
      {dialog === "copy" && copyKey ? (
        <CopyEventDialog cattleId={cattleId} eventKey={copyKey} open onOpenChange={(o) => !o && setDialog(null)} />
      ) : null}
    </>
  );
}
