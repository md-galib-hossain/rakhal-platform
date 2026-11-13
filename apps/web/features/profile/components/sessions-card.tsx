"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Laptop, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@rakhal/ui/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DateText } from "@/components/shared/date-text";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { useSessions } from "../hooks/use-sessions";
import { useRevokeSession } from "../hooks/use-revoke-session";
import { useLogoutAll } from "../hooks/use-logout-all";
import type { SessionItem } from "../types";

function deviceLabel(session: SessionItem, t: (key: string) => string) {
  return session.deviceName || session.userAgent || t("unknownDevice");
}

function statusVariant(status: SessionItem["status"]) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "COMPROMISED") return "destructive" as const;
  return "secondary" as const;
}

export function SessionsCard({ initialSessions, currentSessionId }: { initialSessions: SessionItem[]; currentSessionId: string }) {
  const t = useTranslations("profile");
  const { data: sessions, isError, refetch } = useSessions(initialSessions);
  const revokeSession = useRevokeSession();
  const logoutAll = useLogoutAll();
  const [revokeTarget, setRevokeTarget] = useState<SessionItem | null>(null);
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);

  const list = sessions ?? initialSessions;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>{t("sessions")}</CardTitle>
          <CardDescription>{t("sessionsDescription")}</CardDescription>
        </div>
        <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmLogoutAll(true)}>
          {t("logoutAllDevices")}
        </Button>
      </CardHeader>
      <CardContent>
        {isError ? (
          <ErrorState description={t("sessionsLoadFailed")} onRetry={() => refetch()} />
        ) : list.length === 0 ? (
          <EmptyState title={t("noSessions")} />
        ) : (
          <ul className="flex flex-col gap-3">
            {list.map((session) => {
              const isCurrent = session.id === currentSessionId;
              return (
                <li
                  key={session.id}
                  className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    {session.deviceName?.toLowerCase().includes("mobile") ? (
                      <Smartphone className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
                    ) : (
                      <Laptop className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{deviceLabel(session, t)}</p>
                        {isCurrent ? <Badge variant="info">{t("thisDevice")}</Badge> : null}
                        <Badge variant={statusVariant(session.status)}>{session.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {session.ipAddress ? `${session.ipAddress} · ` : ""}
                        {session.lastUsedAt ? (
                          <>
                            {t("lastActive")} <DateText date={session.lastUsedAt} relative />
                          </>
                        ) : (
                          <>
                            {t("createdAt")} <DateText date={session.createdAt} relative />
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  {session.status === "ACTIVE" && !isCurrent ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={revokeSession.isPending}
                      onClick={() => setRevokeTarget(session)}
                    >
                      {t("revoke")}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title={t("revokeConfirmTitle")}
        description={t("revokeConfirmDescription")}
        confirmLabel={t("revoke")}
        onConfirm={async () => {
          if (!revokeTarget) return;
          try {
            await revokeSession.mutateAsync(revokeTarget.id);
          } catch {
            toast.error(t("revokeFailed"));
          }
        }}
      />

      <ConfirmDialog
        open={confirmLogoutAll}
        onOpenChange={setConfirmLogoutAll}
        title={t("logoutAllConfirmTitle")}
        description={t("logoutAllConfirmDescription")}
        confirmLabel={t("logoutAllDevices")}
        onConfirm={async () => {
          try {
            await logoutAll.mutateAsync();
          } catch {
            toast.error(t("logoutAllFailed"));
          }
        }}
      />
    </Card>
  );
}
