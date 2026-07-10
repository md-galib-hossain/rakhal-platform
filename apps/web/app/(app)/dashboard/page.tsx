import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { serverFetchPage } from "@/lib/api/server-fetch";
import { PageHeader } from "@/components/shared/page-header";

// Placeholder content — now wrapped by the real AppShell (RFE-005); RFE-020 builds the real
// 10-widget dashboard. The cattle count fetch below exists to prove the full RSC → backend chain
// works end-to-end (session cookie → Bearer token → real data), not as product functionality.
export default async function DashboardPage() {
  const t = await getTranslations("nav");
  const session = await getSession();
  const cattle = await serverFetchPage<{ id: string }>("/cattle", { searchParams: { limit: 1 } });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("dashboard")} />
      <p className="text-muted-foreground">
        Signed in as <strong className="text-foreground">{session?.user.name}</strong> ({session?.user.email}) ·
        farm <code className="text-foreground">{session?.farmId}</code>
      </p>
      <p className="text-muted-foreground">
        Live backend check: <strong className="text-foreground">{cattle.meta.count}</strong> cattle on this
        page (of many, cursor-paginated) — proves the RSC→backend fetch chain works.
      </p>
    </div>
  );
}
