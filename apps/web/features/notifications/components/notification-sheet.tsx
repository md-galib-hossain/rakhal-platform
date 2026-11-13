"use client"; // sheet + tab + sub-view state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Settings2 } from "lucide-react";
import { Button } from "@rakhal/ui/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@rakhal/ui/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InboxTab } from "./inbox-tab";
import { NewTab } from "./new-tab";
import { NotificationPreferencesView } from "./notification-preferences-view";
import { UpcomingTab } from "./upcoming-tab";
import { setNotificationSheetView, useNotificationSheetState } from "../sheet-store";

type SheetTab = "inbox" | "upcoming" | "new";
const TABS: SheetTab[] = ["inbox", "upcoming", "new"];

export interface NotificationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** NV2-F02 shell. Each tab body is its own file/export (InboxTab, UpcomingTab, NewTab) so F03/F04/F05 never
 * edit this file. The gear swaps the tabs for the existing preferences view (F05 polishes it). */
export function NotificationSheet({ open, onOpenChange }: NotificationSheetProps) {
  const t = useTranslations("notificationSheet");
  const [tab, setTab] = useState<SheetTab>("inbox");
  const [editingId, setEditingId] = useState<string | null>(null);
  // Tabs vs settings sub-view lives in the shared store (closing resets it) so Settings > Notifications can deep-open it.
  // `compose` is a "Remind me" request (openRemindMe): jump to New with the anchor prefilled.
  const { view, compose } = useNotificationSheetState();
  const [seenCompose, setSeenCompose] = useState(compose);
  if (compose !== seenCompose) {
    setSeenCompose(compose);
    if (compose) {
      setEditingId(null);
      setTab("new");
    }
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 overflow-hidden border-0 p-0 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:max-w-[600px] sm:rounded-[20px] sm:border-2 sm:border-border">
        <SheetHeader className="flex-row items-center gap-2 border-b border-border py-3 pl-4 pr-12">
          {view === "settings" ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label={t("back")}
              onClick={() => setNotificationSheetView("tabs")}
            >
              <ArrowLeft className="size-4" />
            </Button>
          ) : null}
          <div className="min-w-0 flex-1">
            <SheetTitle>{view === "settings" ? t("preferencesTitle") : t("title")}</SheetTitle>
            <SheetDescription className="sr-only">{t("description")}</SheetDescription>
          </div>
          {view === "tabs" ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label={t("preferences")}
              onClick={() => setNotificationSheetView("settings")}
            >
              <Settings2 className="size-4" />
            </Button>
          ) : null}
        </SheetHeader>

        {view === "settings" ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <NotificationPreferencesView />
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as SheetTab)} className="flex min-h-0 flex-1 flex-col">
            <TabsList aria-label={t("tabsLabel")} className="mx-4 mt-3 grid h-11 grid-cols-3">
              {TABS.map((key) => (
                <TabsTrigger key={key} value={key}>
                  {t(`tabs.${key}`)}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              <TabsContent value="inbox">
                <InboxTab onNavigate={() => handleOpenChange(false)} />
              </TabsContent>
              <TabsContent value="upcoming">
                <UpcomingTab
                  onEdit={(id) => {
                    setEditingId(id);
                    setTab("new");
                  }}
                />
              </TabsContent>
              <TabsContent value="new">
                <NewTab
                  key={editingId ?? "create"}
                  editingId={editingId}
                  anchor={editingId ? undefined : compose?.anchor}
                  animal={editingId ? undefined : compose?.animal}
                  onDone={() => {
                    setEditingId(null);
                    setTab("upcoming");
                  }}
                  onCancel={() => {
                    setEditingId(null);
                    setTab("upcoming");
                  }}
                />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
