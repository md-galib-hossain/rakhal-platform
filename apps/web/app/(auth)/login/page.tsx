import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { LoginForm } from "@/features/auth/components/login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: `${t("title")} — Rakhal`, description: t("subtitle") };
}

export default async function LoginPage() {
  const t = await getTranslations("auth.login");
  return (
    <AuthShell title={t("title")} description={t("subtitle")}>
      <LoginForm />
    </AuthShell>
  );
}
