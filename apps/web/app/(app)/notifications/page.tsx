import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { NotificationCenterView } from "@/features/notifications/components/notification-center-view";

export default async function NotificationsPage() {
  const t = await getTranslations("notificationsPage");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} />
      <NotificationCenterView />
    </div>
  );
}
