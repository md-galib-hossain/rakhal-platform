import { ScrollText } from "lucide-react";
import { EmptyState } from "@rakhal/ui/shared/empty-state";
import { PageCard } from "@rakhal/ui/shared/page-card";
import { AuditList } from "@/components/directory/audit-list";
import { SearchForm } from "@/components/directory/search-form";
import { listAudit } from "@/lib/api/directory";
import { PermissionGate } from "@/lib/auth/permission-gate";
import { TIME_ZONE_LABEL } from "@/lib/format";

type SearchParams = Promise<{ search?: string }>;

export default function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <PermissionGate perm="audit.read">
      <AuditPageBody searchParams={searchParams} />
    </PermissionGate>
  );
}

async function AuditPageBody({ searchParams }: { searchParams: SearchParams }) {
  const { search } = await searchParams;
  // The API filters on the exact action code, e.g. LOGIN_FAILED.
  const action = search?.trim().toUpperCase().replace(/\s+/g, "_") || undefined;
  const initial = await listAudit({ action });

  return (
    <PageCard title="Audit log">
      <p className="-mt-2 text-sm text-muted-foreground">
        Append-only trail of admin actions, newest first. Times in {TIME_ZONE_LABEL}.
      </p>
      <SearchForm action="/audit" search={search} placeholder="Filter by action, e.g. LOGIN_FAILED" />
      {initial.items.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={search ? "No entries for this action" : "Nothing recorded yet"}
          description={search ? "Check the action code and try again." : "Admin actions are recorded here as they happen."}
        />
      ) : (
        <AuditList key={action ?? ""} initial={initial} params={{ action }} />
      )}
    </PageCard>
  );
}
