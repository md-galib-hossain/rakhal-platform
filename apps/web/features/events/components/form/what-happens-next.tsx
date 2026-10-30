"use client"; // toggles

import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { DateText } from "@/components/shared/date-text";
import type { FollowUpPreview } from "../../forms/types";

/**
 * "What happens next" (03 §5.2): each follow-up the save would create, with a toggle. One whose day has already
 * passed is shown unticked and marked "(already past)": the user can tick it to create it overdue, or leave it.
 */
export function WhatHappensNext({
  items,
  isOn,
  onToggle,
}: {
  items: FollowUpPreview[];
  isOn: (item: FollowUpPreview) => boolean;
  onToggle: (item: FollowUpPreview, on: boolean) => void;
}) {
  const t = useTranslations("events.form");
  const tLabel = useTranslations("events.form.followUp");
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="what-happens-next" className="flex flex-col gap-1 rounded-lg border border-border p-3">
      <h4 id="what-happens-next" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("whatNext")}
      </h4>
      {items.map((item) => (
        <label key={item.key} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-foreground">
          <Checkbox checked={isOn(item)} onCheckedChange={(checked) => onToggle(item, checked === true)} />
          <span className="flex flex-wrap gap-x-2">
            <span>{tLabel(item.labelKey)}</span>
            {item.dueDate ? <DateText date={`${item.dueDate}T00:00:00`} className="text-muted-foreground" /> : null}
            {item.pastDue ? <span className="text-muted-foreground">({t("alreadyPast")})</span> : null}
          </span>
        </label>
      ))}
    </section>
  );
}
