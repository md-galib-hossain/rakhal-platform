"use client"; // owns the chosen-animal state and opens the workspace

import { useTranslations } from "next-intl";
import { CattlePicker } from "@/components/shared/cattle-picker";
import { FormSheet } from "@/components/shared/form-sheet";
import { useCattleDetailModal } from "@/features/cattle/context/cattle-detail-modal-context";
import type { EventKey } from "@/features/events/types";

export interface RecordEventLauncherProps {
  /** Event to record once an animal is chosen; `null` keeps the chooser closed. */
  eventKey: EventKey | null;
  onClose: () => void;
}

/**
 * Animal-first entry for the Reproduction page's "Record event" menu: pick the animal, then the shared
 * event form opens inside her workspace (`?view=<id>&record=<key>`, RFE-160). Needs-attention rows skip
 * this and call `openCattleDetail` directly because they already know the animal.
 */
export function RecordEventLauncher({ eventKey, onClose }: RecordEventLauncherProps) {
  const t = useTranslations("events.launcher");
  const { openCattleDetail } = useCattleDetailModal();

  return (
    <FormSheet
      open={eventKey !== null}
      onOpenChange={(next) => !next && onClose()}
      title={t("chooseAnimalTitle")}
      description={t("chooseAnimalHint")}
      onSubmit={onClose}
      footer={<span />}
    >
      <CattlePicker
        placeholder={t("chooseAnimal")}
        onValueChange={(id) => {
          if (!eventKey) return;
          onClose();
          openCattleDetail(id, { record: eventKey });
        }}
      />
    </FormSheet>
  );
}
