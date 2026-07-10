"use client";

import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Free-tier sidebar CTA — RFE-008 drives real visibility from `GET /subscription` status. */
export function UpgradeBanner() {
  const t = useTranslations("upgrade");

  return (
    <div className="mx-3 mb-4 flex flex-col gap-2 rounded-lg border border-sidebar-foreground/15 bg-sidebar-foreground/5 p-4">
      <div className="flex items-center gap-2 text-sidebar-foreground">
        <Sparkles className="size-4" aria-hidden />
        <p className="text-sm font-semibold">{t("title")}</p>
      </div>
      <p className="text-xs text-sidebar-muted">{t("description")}</p>
      <Button variant="inverse" size="sm" className="w-full">
        {t("cta")}
      </Button>
    </div>
  );
}
