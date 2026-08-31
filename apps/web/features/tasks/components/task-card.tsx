import { useLocale, useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { avatarTint, initials } from "../avatar-tint";
import { DISPLAY_STATUS_CHIP_VARIANT, PRIORITY_CHIP_VARIANT } from "../task-style";
import { LACTATION_ALERT_ICON, lactationAlertSeverity, parseLactationAlert } from "../lactation-alert";
import type { Task } from "../types";

/** Cow-name display (user request, no ticket #) — Figma's card has no cow-target row at all, so this
 * reuses the card's own existing label/value row style (see `card.category` below) rather than
 * inventing a new visual, per the frontend's "smallest real affordance" precedent. */
function cattleLabel(c: { tagNumber: string; name: string | null }) {
  return c.name ? `${c.tagNumber} — ${c.name}` : c.tagNumber;
}
function cattleSummary(task: Task): string | null {
  if (task.relatedCattle) return cattleLabel(task.relatedCattle);
  if (task.cattleTags.length === 0) return null;
  if (task.cattleTags.length === 1) return cattleLabel(task.cattleTags[0]);
  return `${cattleLabel(task.cattleTags[0])} +${task.cattleTags.length - 1}`;
}

/** Pixel-matched to the Figma "Task Card" (1039:48345/861:14663). */
export function TaskCard({ task, onSeeDetails }: { task: Task; onSeeDetails: (task: Task) => void }) {
  const t = useTranslations("tasks");
  const locale = useLocale() as Locale;

  const dueLabel =
    task.displayStatus === "overdue" && task.overdueByHours !== null
      ? t("card.overdueBy", { hours: task.overdueByHours })
      : formatDate(task.dueAt, locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  // RAKHAL-286's lactation alerts (8 kinds) ride the generic Task Hub — decode the
  // `[LACTATION_ALERT:<TAG>]` dedupe marker the backend embeds in `details` so it doesn't leak
  // to the farmer, and surface a type-specific icon/label chip instead.
  const lactationAlert = parseLactationAlert(task.details);
  const LactationIcon = lactationAlert ? LACTATION_ALERT_ICON[lactationAlert.kind] : null;
  const visibleDetails = lactationAlert ? lactationAlert.cleanDetails : task.details;

  // A completed/cancelled task must never look identical to a live one — muted card, status chip,
  // strikethrough title (not color alone).
  const isClosed = task.displayStatus === "completed" || task.displayStatus === "cancelled";

  return (
    <div className={cn("flex w-full flex-col gap-5 rounded-2xl border border-border bg-card p-4", isClosed && "opacity-70")}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-muted-foreground">{task.reference}</p>
          <Chip variant={DISPLAY_STATUS_CHIP_VARIANT[task.displayStatus]} subtle className="w-fit">
            {t(`status.${task.displayStatus}`)}
          </Chip>
        </div>
        <div className="flex flex-col gap-2">
          {lactationAlert && LactationIcon ? (
            <Chip variant={lactationAlertSeverity(lactationAlert.kind)} subtle className="w-fit gap-1.5">
              <LactationIcon className="size-3.5" aria-hidden />
              {t(`lactationAlert.${lactationAlert.kind}`)}
            </Chip>
          ) : null}
          <p className={cn("text-xl font-bold text-foreground", isClosed && "line-through")}>{task.name}</p>
          {visibleDetails ? <p className="line-clamp-2 text-sm font-medium text-muted-foreground">{visibleDetails}</p> : null}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{t("card.priority")}</p>
          <Chip variant={PRIORITY_CHIP_VARIANT[task.priority]} subtle>
            {t(`priority.${task.priority}`)}
          </Chip>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{t("card.dueDate")}</p>
          <Chip variant={task.displayStatus === "overdue" ? "destructive" : "muted"}>{dueLabel}</Chip>
        </div>
        <div className="flex items-center justify-between text-sm">
          <p className="font-medium text-muted-foreground">{t("card.category")}</p>
          <p className="font-bold text-foreground">{t(`category.${task.category}`)}</p>
        </div>
        {cattleSummary(task) ? (
          <div className="flex items-center justify-between text-sm">
            <p className="font-medium text-muted-foreground">{t("card.cow")}</p>
            <p className="font-bold text-foreground">{cattleSummary(task)}</p>
          </div>
        ) : null}
      </div>

      <div className="flex w-full items-center justify-between rounded-xl border border-border bg-muted px-3 py-2">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t("card.assignedTo")}</p>
          {task.assignedTo ? (
            <div className="flex items-center gap-2">
              <Avatar className="size-6">
                <AvatarFallback className={avatarTint(task.assignedTo.id)}>{initials(task.assignedTo.name)}</AvatarFallback>
              </Avatar>
              <p className="text-base font-bold text-foreground">{task.assignedTo.name}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("card.unassigned")}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onSeeDetails(task)}
          className="flex items-center gap-2 rounded-lg border-[1.5px] border-border bg-card px-4 py-2.5 text-sm font-bold text-muted-foreground transition-colors hover:bg-accent"
        >
          {t("card.seeDetails")}
          <ArrowRight className="size-[18px]" aria-hidden />
        </button>
      </div>
    </div>
  );
}
