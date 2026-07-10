import { getTranslations } from "next-intl/server";
import { RouteStub } from "@/components/layout/route-stub";

export default async function NotificationsPage() {
  const t = await getTranslations("routeStub");
  return <RouteStub title={t("notifications")} />;
}
