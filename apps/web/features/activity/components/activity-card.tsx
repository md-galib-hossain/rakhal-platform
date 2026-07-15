import { User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { cn } from "@/lib/utils";
import { avatarTint } from "../avatar-tint";
import { ActionDetails } from "../action-details";
import { MODULE_STYLE } from "../module-style";
import type { ActivityLogEntry } from "../types";

/** One timeline row: time gutter + card (Figma "Activity Log" component, 734:51037/41/45/55/59/63) —
 * icon+title, AQR-delta chip (if `aqrImpact` is non-null) + module chip, the parsed Action Details
 * line, actor (or a generic "System" avatar for system-originated entries), and a right-aligned
 * Financial Impact tile (if `financialImpact` is non-null). */
export function ActivityCard({ entry, className }: { entry: ActivityLogEntry; className?: string }) {
  const style = MODULE_STYLE[entry.module];
  const Icon = style.icon;

  return (
    <div className={cn("flex gap-9 items-start", className)}>
      <div className="w-[62px] shrink-0 pt-2 text-xs text-muted-foreground">
        <DateText date={entry.timestamp} options={{ hour: "numeric", minute: "2-digit" }} />
      </div>
      <div className="flex flex-1 flex-col gap-4 rounded-2xl bg-card p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className={cn("flex size-8 items-center justify-center rounded-lg shadow-xs", style.iconBg)}>
              <Icon className={cn("size-5", style.iconFg)} aria-hidden />
            </div>
            <p className="text-base font-bold text-foreground">{entry.eventTitle}</p>
          </div>
          <div className="flex items-start gap-2">
            {entry.aqrImpact !== null ? (
              <Chip variant={entry.aqrImpact >= 0 ? "primary" : "destructive"}>
                {entry.aqrImpact >= 0 ? "+" : ""}
                {entry.aqrImpact} AQR
              </Chip>
            ) : null}
            <Chip variant={style.variant}>{entry.moduleLabel}</Chip>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Action Details:</p>
          <ActionDetails text={entry.actionDetails} />
        </div>

        <div className="flex items-end justify-between gap-2">
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">Actor:</p>
            <div className="flex items-center gap-1.5">
              {entry.actorType === "system" ? (
                <Avatar className="size-5">
                  <AvatarFallback>
                    <User className="size-3" aria-hidden />
                  </AvatarFallback>
                </Avatar>
              ) : (
                <Avatar className="size-5">
                  <AvatarFallback className={avatarTint(entry.actor.id ?? entry.actor.name)}>
                    {entry.actor.name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
              <p className="text-sm font-medium text-foreground">{entry.actor.name}</p>
            </div>
          </div>
          {entry.financialImpact !== null ? (
            <div className="flex flex-col items-end gap-2">
              <p className="text-xs text-muted-foreground">Financial Impact:</p>
              <div className={cn("flex items-center gap-0.5", entry.financialImpact >= 0 ? "text-success" : "text-destructive")}>
                <span className="text-sm font-medium">{entry.financialImpact >= 0 ? "+" : "-"}</span>
                <MoneyText amount={Math.abs(entry.financialImpact)} className="text-lg font-bold" />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
