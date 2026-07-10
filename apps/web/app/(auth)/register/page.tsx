import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { RegisterForm } from "@/features/auth/components/register-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.register");
  return { title: `${t("title")} — Rakhal`, description: t("subtitle") };
}

export default async function RegisterPage() {
  const t = await getTranslations("auth.register");
  return (
    <AuthShell title={t("title")} description={t("subtitle")}>
      <RegisterForm />
    </AuthShell>
  );
}
