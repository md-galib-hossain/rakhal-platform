import { PageHeader } from "@rakhal/ui/shared/page-header";
import { PermissionGate } from "@/lib/auth/permission-gate";

export default function UsersPage() {
  return (
    <PermissionGate perm="user.read">
      <PageHeader title="Users" description="Look up users and their memberships. Arrives in Phase 3." />
    </PermissionGate>
  );
}
