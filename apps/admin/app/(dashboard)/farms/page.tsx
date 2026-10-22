import { Building2 } from "lucide-react";
import { EmptyState } from "@rakhal/ui/shared/empty-state";
import { PageCard } from "@rakhal/ui/shared/page-card";
import { FarmsList } from "@/components/directory/farms-list";
import { SearchForm } from "@/components/directory/search-form";
import { listFarms } from "@/lib/api/directory";
import { PermissionGate } from "@/lib/auth/permission-gate";

const STATUSES = ["ACTIVE", "SUSPENDED", "ARCHIVED"];

type SearchParams = Promise<{ search?: string; status?: string }>;

export default function FarmsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <PermissionGate perm="farm.read">
      <FarmsPageBody searchParams={searchParams} />
    </PermissionGate>
  );
}

async function FarmsPageBody({ searchParams }: { searchParams: SearchParams }) {
  const { search, status } = await searchParams;
  const safeStatus = status && STATUSES.includes(status) ? status : undefined;
  const initial = await listFarms({ search, status: safeStatus });

  return (
    <PageCard title="Farms">
      <p className="-mt-2 text-sm text-muted-foreground">Find a farm by name, code, phone or owner.</p>
      <SearchForm
        action="/farms"
        search={search}
        status={safeStatus}
        statusOptions={STATUSES}
        placeholder="Search farms or owners"
      />
      {initial.items.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={search || safeStatus ? "No farms match this search" : "No farms yet"}
          description={search || safeStatus ? "Try a different name, code or status." : "Farms appear here once owners sign up."}
        />
      ) : (
        <FarmsList key={`${search ?? ""}|${safeStatus ?? ""}`} initial={initial} params={{ search, status: safeStatus }} />
      )}
    </PageCard>
  );
}
