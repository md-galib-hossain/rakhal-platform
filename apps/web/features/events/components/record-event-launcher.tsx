"use client"; // owns the chosen-animal state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { CattlePicker } from "@/components/shared/cattle-picker";
import { FormSheet } from "@/components/shared/form-sheet";
import { useCattleDetail } from "@/features/cattle/hooks/use-cattle";
import { EventFormPanel } from "@/features/events/components/form/event-form-panel";
import type { EventKey } from "@/features/events/types";

export interface RecordEventLauncherProps {
  /** Event to record once an animal is chosen; `null` keeps the chooser closed. */
  eventKey: EventKey | null;
  onClose: () => void;
}

/**
 * Animal-first entry for page-level "Report sickness" / "Record treatment" buttons: pick the animal, then the shared
 * event form opens right here. It does NOT open the animal workspace behind it (the old `?view=<id>&record=<key>` hop did,
 * which stacked a second modal under the form). Back returns to the chooser; Save closes everything.
 */
export function RecordEventLauncher({ eventKey, onClose }: RecordEventLauncherProps) {
  const t = useTranslations("events.launcher");
  const [cattleId, setCattleId] = useState<string | undefined>(undefined);
  const { data: cattle, isError } = useCattleDetail(cattleId);
  // Between picking an animal and its record arriving (1-2 s) the chooser stays up, locked, with a spinner.
  const loading = Boolean(cattleId) && !cattle && !isError;

  const close = () => {
    setCattleId(undefined);
    onClose();
  };

  return (
    <>
      <FormSheet
        open={eventKey !== null && (!cattleId || !cattle)}
        onOpenChange={(next) => !next && close()}
        title={t("chooseAnimalTitle")}
        description={t("chooseAnimalHint")}
        onSubmit={close}
        footer={<span />}
      >
        <div className="flex flex-col gap-3">
          <CattlePicker placeholder={t("chooseAnimal")} value={cattleId} disabled={loading} onValueChange={(id) => setCattleId(id)} />
          {loading ? (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              {t("loadingAnimal")}
            </p>
          ) : null}
        </div>
      </FormSheet>
      {eventKey && cattleId && cattle ? (
        <EventFormPanel
          key={`${eventKey}-${cattleId}`}
          eventKey={eventKey}
          cattle={cattle}
          onBack={() => setCattleId(undefined)}
          onDone={close}
        />
      ) : null}
    </>
  );
}
