import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { VerifyEmailStatus } from "@/features/auth/components/verify-email-status";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.verifyEmail");
  return { title: `${t("title")} — Rakhal`, robots: { index: false } };
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const t = await getTranslations("auth.verifyEmail");
  return (
    <AuthShell title={t("title")}>
      <VerifyEmailStatus token={token} />
    </AuthShell>
  );
}
