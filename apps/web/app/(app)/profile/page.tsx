import { getTranslations } from "next-intl/server";
import { serverFetch } from "@/lib/api/server-fetch";
import { getSession } from "@/lib/auth/session";
import { PageHeader } from "@rakhal/ui/shared/page-header";
import { AccountInfoCard } from "@/features/profile/components/account-info-card";
import { LanguagePreferenceCard } from "@/features/profile/components/language-preference-card";
import { SessionsCard } from "@/features/profile/components/sessions-card";
import type { ProfileUser, SessionItem } from "@/features/profile/types";

export default async function ProfilePage() {
  const [t, user, sessions, session] = await Promise.all([
    getTranslations("profile"),
    serverFetch<ProfileUser>("/auth/me"),
    serverFetch<SessionItem[]>("/auth/sessions"),
    getSession(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <AccountInfoCard user={user} />
        <LanguagePreferenceCard initialUser={user} />
      </div>
      <SessionsCard initialSessions={sessions} currentSessionId={session?.sessionId ?? ""} />
    </div>
  );
}
