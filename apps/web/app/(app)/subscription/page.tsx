import { getTranslations } from "next-intl/server";
import { RouteStub } from "@/components/layout/route-stub";

export default async function SubscriptionPage() {
  const t = await getTranslations("routeStub");
  return <RouteStub title={t("subscription")} />;
}
