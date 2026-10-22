import { PageHeader } from "@rakhal/ui/shared/page-header";
import { PermissionGate } from "@/lib/auth/permission-gate";

export default function FarmsPage() {
  return (
    <PermissionGate perm="farm.read">
      <PageHeader title="Farms" description="Search and manage tenants. Arrives in Phase 3." />
    </PermissionGate>
  );
}
