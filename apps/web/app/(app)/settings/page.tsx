import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsTabs } from "@/features/settings/components/settings-tabs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: `${t("title")} — Rakhal`, robots: { index: false } };
}

/** Settings — Figma "Settings/Module Settings" frame (`1039:51174`, file `SCfMPdxP6vgW1uTxfqCtz7`).
 * Tab-rail + routed content; the Billing & Subscription tab (RFE-036) is the one built this pass. */
export default async function SettingsPage() {
  const t = await getTranslations("settings");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} />
      {/* SettingsTabs reads the `?tab=` query param via nuqs (useSearchParams) — Suspense-wrapped
          per Next's requirement, mirroring the Finance page. */}
      <Suspense fallback={null}>
        <SettingsTabs />
      </Suspense>
    </div>
  );
}
