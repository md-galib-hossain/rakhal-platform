"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProfile } from "../hooks/use-profile";
import { useUpdateLanguage } from "../hooks/use-update-language";
import type { ProfileUser } from "../types";

export function LanguagePreferenceCard({ initialUser }: { initialUser: ProfileUser }) {
  const t = useTranslations("profile");
  const { data: user } = useProfile(initialUser);
  const updateLanguage = useUpdateLanguage();
  const current = user?.preferredLanguage ?? initialUser.preferredLanguage;

  function select(next: "BN" | "EN") {
    if (next === current || updateLanguage.isPending) return;
    updateLanguage.mutate(next, {
      onError: () => toast.error(t("languageUpdateFailed")),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("language")}</CardTitle>
        <CardDescription>{t("languageDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button
          type="button"
          variant={current === "BN" ? "primary" : "outline"}
          disabled={updateLanguage.isPending}
          onClick={() => select("BN")}
        >
          {t("languageBn")}
        </Button>
        <Button
          type="button"
          variant={current === "EN" ? "primary" : "outline"}
          disabled={updateLanguage.isPending}
          onClick={() => select("EN")}
        >
          {t("languageEn")}
        </Button>
      </CardContent>
    </Card>
  );
}
