"use client";

import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Free-tier sidebar CTA — RFE-008 drives real visibility from `GET /subscription` status. */
export function UpgradeBanner() {
  const t = useTranslations("upgrade");

  return (
    <div className="relative flex flex-col items-center gap-2 overflow-hidden rounded-xl bg-black/20 p-4 text-center">
      <div className="flex size-10 items-center justify-center rounded-[10px] border border-primary-hover bg-primary/10 text-sidebar-foreground">
        <Sparkles className="size-5" aria-hidden />
      </div>
      <p className="text-base font-bold text-sidebar-foreground">{t("title")}</p>
      <p className="text-xs text-sidebar-muted">{t("description")}</p>
      <Button size="sm" className="mt-1 w-full">
        {t("cta")}
      </Button>
    </div>
  );
}
