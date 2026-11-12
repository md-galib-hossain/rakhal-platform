"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { qk } from "@/lib/query/keys";
import { setLocale } from "@/lib/i18n/set-locale";
import { profileApi } from "../api";

/** Persists the backend preference (`PATCH /auth/me/language`) AND flips the local UI-locale
 * cookie in the same action, so the profile page's language control and the topbar's quick
 * `LocaleToggle`/`LanguageToggleItem` (cookie-only, RFE-005) never disagree. */
export function useUpdateLanguage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async (preferredLanguage: "BN" | "EN") => {
      const [updated] = await Promise.all([
        profileApi.updateLanguage(preferredLanguage),
        setLocale(preferredLanguage === "BN" ? "bn" : "en"),
      ]);
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(qk.profile.me(), updated);
      router.refresh();
    },
  });
}
