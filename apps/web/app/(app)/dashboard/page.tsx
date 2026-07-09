import { useTranslations } from "next-intl";

// Placeholder — RFE-005 wraps this in AppShell; RFE-020 builds the real 10-widget dashboard.
export default function DashboardPage() {
  const t = useTranslations("nav");
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">{t("dashboard")}</h1>
    </div>
  );
}
