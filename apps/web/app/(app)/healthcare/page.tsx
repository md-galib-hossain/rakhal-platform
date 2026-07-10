import { getTranslations } from "next-intl/server";
import { RouteStub } from "@/components/layout/route-stub";

export default async function HealthcarePage() {
  const t = await getTranslations("nav");
  return <RouteStub title={t("healthcare")} />;
}
