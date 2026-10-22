import { Users } from "lucide-react";
import { EmptyState } from "@rakhal/ui/shared/empty-state";
import { PageCard } from "@rakhal/ui/shared/page-card";
import { SearchForm } from "@/components/directory/search-form";
import { UsersList } from "@/components/directory/users-list";
import { listUsers } from "@/lib/api/directory";
import { PermissionGate } from "@/lib/auth/permission-gate";

type SearchParams = Promise<{ search?: string }>;

export default function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <PermissionGate perm="user.read">
      <UsersPageBody searchParams={searchParams} />
    </PermissionGate>
  );
}

async function UsersPageBody({ searchParams }: { searchParams: SearchParams }) {
  const { search } = await searchParams;
  const initial = await listUsers({ search });

  return (
    <PageCard title="Users">
      <p className="-mt-2 text-sm text-muted-foreground">Find a user by name or email.</p>
      <SearchForm action="/users" search={search} placeholder="Search users" />
      {initial.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? "No users match this search" : "No users yet"}
          description={search ? "Try a different name or email." : "Users appear here once they sign up."}
        />
      ) : (
        <UsersList key={search ?? ""} initial={initial} params={{ search }} />
      )}
    </PageCard>
  );
}
