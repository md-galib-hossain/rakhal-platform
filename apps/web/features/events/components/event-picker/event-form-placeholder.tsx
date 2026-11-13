"use client"; // button handler

import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Button } from "@rakhal/ui/ui/button";
import type { EventKey } from "../../types";

/**
 * Stand-in for the event form while RFE-158/159 are unbuilt: opens when the picker (or `?record=<key>`) selects an
 * event, says clearly nothing was saved, and returns to the picker. Docked over the right column at ≥1024px
 * (03 §5.1), a full-screen layer below. Replaced by the real form framework in RFE-158.
 */
export function EventFormPlaceholder({
  eventKey,
  animalName,
  onBack,
}: {
  eventKey: EventKey;
  animalName: string;
  onBack: () => void;
}) {
  const t = useTranslations("events.picker");
  const tCatalogue = useTranslations(`events.catalogue.${eventKey}`);
  return (
    <section
      aria-labelledby="event-form-placeholder-title"
      className="fixed inset-0 z-[60] flex flex-col gap-4 bg-card p-4 lg:absolute lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[460px] lg:rounded-r-[18px] lg:border-l lg:border-border lg:p-5 lg:shadow-xl"
    >
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" aria-label={t("back")} onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden />
        </Button>
        <h3 id="event-form-placeholder-title" className="text-base font-semibold text-foreground">
          {t("placeholderTitle", { event: tCatalogue("label"), name: animalName })}
        </h3>
      </div>
      <p className="text-sm text-muted-foreground">{t("placeholderBody")}</p>
    </section>
  );
}
