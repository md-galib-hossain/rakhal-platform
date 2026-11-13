"use client";

import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenuItem } from "@rakhal/ui/ui/dropdown-menu";
import { useUpdateLanguage } from "@/features/profile/hooks/use-update-language";
import { type Locale, locales } from "@/lib/constants/i18n";

/** Avatar-menu language toggle — persists the backend `preferredLanguage` AND swaps the
 * `NEXT_LOCALE` cookie (via the shared `useUpdateLanguage`, which also refreshes the RSC tree), so
 * server-rendered copy (notifications, SMS/push/email) follows the UI language. */
export function LanguageToggleItem() {
  const t = useTranslations("topbar");
  const tProfile = useTranslations("profile");
  const locale = useLocale() as Locale;
  const updateLanguage = useUpdateLanguage();
  const next = locales.find((l) => l !== locale) ?? locale;

  return (
    <DropdownMenuItem
      disabled={updateLanguage.isPending}
      onSelect={(event) => {
        event.preventDefault();
        updateLanguage.mutate(next === "bn" ? "BN" : "EN", {
          onError: () => toast.error(tProfile("languageUpdateFailed")),
        });
      }}
    >
      <Languages className="size-4" />
      {t("language")} ({next.toUpperCase()})
    </DropdownMenuItem>
  );
}
