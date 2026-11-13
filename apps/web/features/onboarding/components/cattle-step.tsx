"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { Button } from "@rakhal/ui/ui/button";
import { CattleFormDialog } from "@/features/cattle/components/cattle-form-dialog";
import { useOnboardingStatus } from "../hooks/use-onboarding-status";

/** Wizard Step 3 (PRD §5.1 Step 4) — "Add your first animals": a guided single add
 * reusing RFE-022's real dialog. */
export function CattleStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const t = useTranslations("onboarding.wizard.cattle");
  const [addOpen, setAddOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data: status } = useOnboardingStatus();
  const count = status?.steps.cattle.count ?? 0;

  function refreshCount() {
    queryClient.invalidateQueries({ queryKey: qk.onboarding.status() });
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">{t("description")}</p>

      {count > 0 ? (
        <p className="text-sm font-medium text-success">{t("countAdded", { count })}</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" aria-hidden />
          {t("addOne")}
        </Button>
      </div>

      <CattleFormDialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) refreshCount();
        }}
      />

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onSkip}>
          {t("skip")}
        </Button>
        <Button type="button" onClick={onNext}>
          {t("continue")}
        </Button>
      </div>
    </div>
  );
}
