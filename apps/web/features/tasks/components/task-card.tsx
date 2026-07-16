import { useLocale, useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { avatarTint, initials } from "../avatar-tint";
import { PRIORITY_CHIP_VARIANT } from "../task-style";
import type { Task } from "../types";

/** Pixel-matched to the Figma "Task Card" (1039:48345/861:14663). */
export function TaskCard({ task, onSeeDetails }: { task: Task; onSeeDetails: (task: Task) => void }) {
  const t = useTranslations("tasks");
  const locale = useLocale() as Locale;

  const dueLabel =
    task.displayStatus === "overdue" && task.overdueByHours !== null
      ? t("card.overdueBy", { hours: task.overdueByHours })
      : formatDate(task.dueAt, locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  return (
    <div className="flex w-full flex-col gap-5 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold text-muted-foreground">{task.reference}</p>
        <div className="flex flex-col gap-2">
          <p className="text-xl font-bold text-foreground">{task.name}</p>
          {task.details ? <p className="line-clamp-2 text-sm font-medium text-muted-foreground">{task.details}</p> : null}
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
          <p className="font-medium text-muted-foreground">{t("card.stepsCompleted")}</p>
          <p className="font-bold text-foreground">
            {t("card.stepsCount", { completed: task.stepsCompleted, total: task.stepsTotal })}
          </p>
        </div>
        <div className="flex items-center justify-between text-sm">
          <p className="font-medium text-muted-foreground">{t("card.category")}</p>
          <p className="font-bold text-foreground">{t(`category.${task.category}`)}</p>
        </div>
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
