"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { setLocale } from "@/lib/i18n/set-locale";
import { type Locale, locales } from "@/lib/constants/i18n";

/** Avatar-menu language toggle — swaps the `NEXT_LOCALE` cookie and refreshes the RSC tree. */
export function LanguageToggleItem() {
  const t = useTranslations("topbar");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = locales.find((l) => l !== locale) ?? locale;

  return (
    <DropdownMenuItem
      disabled={pending}
      onSelect={(event) => {
        event.preventDefault();
        startTransition(async () => {
          await setLocale(next);
          router.refresh();
        });
      }}
    >
      <Languages className="size-4" />
      {t("language")} ({next.toUpperCase()})
    </DropdownMenuItem>
  );
}
