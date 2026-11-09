"use client"; // live query, URL-synced section/record state, global hotkey

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/permissions";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { RowAction } from "@/components/shared/row-actions-menu";
import { EventFormPlaceholder } from "@/features/events/components/event-picker/event-form-placeholder";
import { EventPicker } from "@/features/events/components/event-picker/event-picker";
import { EventFormPanel } from "@/features/events/components/form/event-form-panel";
import { openRemindMe } from "@/features/notifications/sheet-store";
import { DISPOSE_EVENTS, FORM_DEFS } from "@/features/events/forms/definitions";
import { EVENT_KEYS, type EventKey } from "@/features/events/types";
import { useCattleDetail, useRestoreCattle } from "../../hooks/use-cattle";
import type { CattleDetail } from "../../types";
import { resolveSection, type SectionKey } from "./section-state";
// Sections reuse components that open other animals via the provider that dynamically loads this file (same loop the old drawer had).
// eslint-disable-next-line import/no-cycle
import { SectionBody, SectionSwitcher } from "./workspace-sections";
import { WorkspaceHeader } from "./workspace-header";
import { ProfileDrawer } from "./profile/profile-drawer";
import { WorkspaceSkeleton } from "./workspace-skeleton";
import { quickActionsFor } from "./quick-actions";
import { WS_SHELL } from "./workspace-grid";
import { isNotFound, StaleBanner, WorkspaceError } from "./workspace-status";
import type { DrillKey } from "./state-cards/state-column";

function isEventKey(value: string): value is EventKey {
  return (EVENT_KEYS as readonly string[]).includes(value);
}

/**
 * Animal Workspace (MILESTONE 31, RFE-154) — replaces the old narrow 8-tab detail drawer. One right-anchored sheet, at most
 * 1280px wide (RFE-185), full screen below 640px. Header (identity + state chips + Record event), four sections (Timeline / Feeding /
 * Family / Money), and URL state: `?view=<id>` (owned by `CattleDetailModalProvider`), `&section=`, `&record=<eventKey>`,
 * `&ref=<reminderId>` so a notification can open a form directly. The footer bar is gone; Dispose / Delete / Restore
 * live in `⋯`.
 */
export function AnimalWorkspace({
  cattleId,
  onOpenChange,
  onDispose,
  onDelete,
  formOnly = false,
}: {
  cattleId: string | undefined;
  /** Opened from another page's "Record …" button: show only the event form, not the workspace behind it. */
  formOnly?: boolean;
  onOpenChange: (open: boolean) => void;
  onDispose: (cattle: CattleDetail) => void;
  onDelete: (cattle: CattleDetail) => void;
}) {
  const t = useTranslations("events.workspace");
  const tActions = useTranslations("cattle.actions");
  const tCatalogue = useTranslations("events.catalogue");
  const can = useCan();
  const query = useCattleDetail(cattleId);
  const restore = useRestoreCattle();
  const cattle = query.data;

  const [sectionParam, setSectionParam] = useQueryState("section", parseAsString);
  const [legacyTab, setLegacyTab] = useQueryState("tab", parseAsString);
  const [record, setRecord] = useQueryState("record", parseAsString);
  const [, setRef] = useQueryState("ref", parseAsString);
  const [drill, setDrill] = useState<DrillKey | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // RFE-181: Edit profile is a drawer inside the workspace, not a separate sheet.
  const [editOpen, setEditOpen] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const canSeeMoney = can("finance.read");
  const section = resolveSection(sectionParam, legacyTab, canSeeMoney);
  const isDeleted = cattle?.deletedAt != null;
  const isActive = cattle?.herdStatus === "ACTIVE";
  const canRecord = Boolean(cattle) && !isDeleted;
  const quickActions = cattle && canRecord ? quickActionsFor(cattle, can) : [];

  // The heading only exists once the animal has loaded, after the sheet's own open-focus pass; focus it then so a
  // screen reader hears who this is (03 §10).
  const loadedId = cattle?.id;
  useEffect(() => {
    if (loadedId) titleRef.current?.focus();
  }, [loadedId]);

  // An old `?record=REMINDER` link now opens the notification sheet's New tab for this animal, then clears the param.
  useEffect(() => {
    if (record !== "REMINDER" || !cattle) return;
    openRemindMe({ animal: { id: cattle.id, tagNumber: cattle.tagNumber, name: cattle.name } });
    void setRecord(null);
  }, [record, cattle, setRecord]);

  // Ctrl/Cmd+K opens the event picker while the workspace is open; `GlobalSearch` stands down for the same key.
  useEffect(() => {
    if (!canRecord) return;
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPickerOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [canRecord]);

  function closeWorkspace(open: boolean) {
    if (!open) {
      void setSectionParam(null);
      void setLegacyTab(null);
      void setRecord(null);
      void setRef(null);
    }
    onOpenChange(open);
  }

  function selectSection(next: SectionKey) {
    setDrill(null);
    void setLegacyTab(null);
    void setSectionParam(next);
  }

  async function handleRestore() {
    if (!cattle) return;
    try {
      await restore.mutateAsync(cattle.id);
      toast.success(tActions("restoredToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tActions("genericError"));
    }
  }

  const actions: RowAction[] = [];
  if (cattle) {
    if (isDeleted && can("cattle.update")) actions.push({ key: "restore", label: tActions("restore"), onSelect: () => void handleRestore() });
    if (!isDeleted && isActive && can("cattle.dispose")) actions.push({ key: "dispose", label: tActions("dispose"), onSelect: () => onDispose(cattle) });
    if (!isDeleted && can("cattle.delete")) actions.push({ key: "delete", label: tActions("delete"), destructive: true, onSelect: () => onDelete(cattle) });
  }

  // Record-from-elsewhere (e.g. Reproduction "Record AI"): just the form, no profile sheet behind it. Esc/back/done close it all.
  if (formOnly && cattleId) {
    if (cattle && canRecord && record && isEventKey(record) && FORM_DEFS[record] && !DISPOSE_EVENTS.includes(record)) {
      return (
        <EventFormPanel
          key={record}
          eventKey={record}
          cattle={cattle}
          onBack={() => closeWorkspace(false)}
          onDone={() => closeWorkspace(false)}
        />
      );
    }
    if (query.isLoading) return null;
  }

  return (
    <Sheet open={Boolean(cattleId)} onOpenChange={closeWorkspace}>
      <SheetContent
        showClose={false}
        data-animal-workspace=""
        // Esc closes the topmost layer only: form panel → drill panel → workspace (03 §10). The picker is its own
        // dialog and takes Esc before this handler is reached.
        onEscapeKeyDown={(event) => {
          if (record) {
            event.preventDefault();
            void setRecord(null);
          } else if (drill) {
            event.preventDefault();
            setDrill(null);
          }
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
        // RFE-185: right-anchored, content-sized shell (`WS_SHELL`); full screen under 640px.
        className={WS_SHELL}
      >
        {query.isLoading ? (
          <>
            <SheetTitle className="sr-only">{t("title")}</SheetTitle>
            <WorkspaceSkeleton onClose={() => closeWorkspace(false)} />
          </>
        ) : (
          <>
            {cattle ? (
              <WorkspaceHeader
                cattle={cattle}
                titleRef={titleRef}
                actions={actions}
                canEdit={can("cattle.update")}
                canRecord={canRecord}
                quickActions={quickActions}
                onRecord={() => setPickerOpen(true)}
                onQuickAction={(key) => void setRecord(key)}
                onEdit={() => setEditOpen(true)}
                onClose={() => closeWorkspace(false)}
              />
            ) : (
              <SheetTitle className="sr-only">{t("title")}</SheetTitle>
            )}
            <div className="border-t border-border" />

            {/* Header and tabs sit outside the scroller, so they never scroll away (RFE-172). */}
            <div className="flex min-h-0 flex-1 flex-col gap-4 pt-0">
              {!cattle ? (
                // Only when there is nothing to show: a failed background refetch keeps the cached animal (RFE-170).
                <WorkspaceError
                  notFound={isNotFound(query.error)}
                  retrying={query.isFetching}
                  onRetry={() => void query.refetch()}
                  onClose={() => closeWorkspace(false)}
                />
              ) : (
                <>
                  {query.isError ? <StaleBanner retrying={query.isFetching} onRetry={() => void query.refetch()} /> : null}
                  {!isActive && !isDeleted ? (
                    <Card className="border-warning/40 bg-warning-tint p-3 text-sm font-medium text-warning">{t("leftHerd")}</Card>
                  ) : null}
                  <SectionSwitcher value={section} canSeeMoney={canSeeMoney} onChange={selectSection} />
                  <SectionBody
                    section={section}
                    cattle={cattle}
                    drill={drill}
                    onDrill={setDrill}
                    canRecord={canRecord}
                    onSeeAll={() => selectSection("timeline")}
                    onRecord={(key, ref) => {
                      void setRef(ref || null);
                      void setRecord(key);
                    }}
                  />
                </>
              )}
            </div>
          </>
        )}

        {canRecord ? (
          <div className="-mx-4 flex gap-2 border-t border-border bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
            {quickActions.slice(0, 2).map((key) => (
              <Button key={key} type="button" variant="outline" className="h-12 shrink-0 px-3" onClick={() => void setRecord(key)}>
                {tCatalogue(`${key}.label`)}
              </Button>
            ))}
            <Button type="button" className="h-12 min-w-0 flex-1 gap-2" onClick={() => setPickerOpen(true)}>
              <Plus className="size-5" aria-hidden />
              {t("recordEvent")}
            </Button>
          </div>
        ) : null}
        {cattle && editOpen && can("cattle.update") ? <ProfileDrawer cattle={cattle} onClose={() => setEditOpen(false)} /> : null}
        {cattle && canRecord ? (
          <EventPicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            animal={cattle}
            onPick={(key) => {
              setPickerOpen(false);
              // Sell / death / cull are the existing dispose dialog (RFE-159), not a form of their own.
              if (DISPOSE_EVENTS.includes(key)) onDispose(cattle);
              // NV2: the picker's "Reminder" opens the notification sheet's New tab for this animal (not an event form).
              else if (key === "REMINDER") openRemindMe({ animal: { id: cattle.id, tagNumber: cattle.tagNumber, name: cattle.name } });
              else void setRecord(key);
            }}
          />
        ) : null}
        {/* The event form (RFE-158/159); `?record=<key>` deep links land here too. */}
        {cattle && canRecord && record && isEventKey(record) && FORM_DEFS[record] ? (
          <EventFormPanel
            key={record}
            eventKey={record}
            cattle={cattle}
            onBack={() => {
              void setRecord(null);
              setPickerOpen(true);
            }}
            onDone={() => void setRecord(null)}
          />
        ) : cattle && canRecord && record && record !== "REMINDER" && isEventKey(record) && !DISPOSE_EVENTS.includes(record) ? (
          <EventFormPlaceholder
            eventKey={record}
            animalName={cattle.name ?? cattle.tagNumber}
            onBack={() => {
              void setRecord(null);
              setPickerOpen(true);
            }}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
