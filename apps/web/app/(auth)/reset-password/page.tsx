import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.resetPassword");
  return { title: `${t("title")} — Rakhal`, description: t("subtitle"), robots: { index: false } };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const t = await getTranslations("auth.resetPassword");
  return (
    <AuthShell title={t("title")} description={t("subtitle")}>
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
