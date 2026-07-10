import { getTranslations } from "next-intl/server";
import { RouteStub } from "@/components/layout/route-stub";

export default async function CalvesPage() {
  const t = await getTranslations("nav");
  return <RouteStub title={t("calves")} />;
}
