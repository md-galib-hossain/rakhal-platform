"use client"; // reads the active locale and calls the setLocale server action

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/lib/i18n/set-locale";

export function LocaleToggle() {
  const locale = useLocale();
  const t = useTranslations("topbar");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = locale === "bn" ? "en" : "bn";

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={t("language")}
      onClick={() =>
        startTransition(async () => {
          await setLocale(next);
          router.refresh();
        })
      }
      className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
    >
      <Languages className="size-4" aria-hidden />
      {locale === "bn" ? "EN" : "বাং"}
    </button>
  );
}
