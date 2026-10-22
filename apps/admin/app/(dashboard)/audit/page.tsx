import { PageHeader } from "@rakhal/ui/shared/page-header";
import { PermissionGate } from "@/lib/auth/permission-gate";

export default function AuditPage() {
  return (
    <PermissionGate perm="audit.read">
      <PageHeader title="Audit log" description="The append-only trail of admin actions. Arrives in Phase 3." />
    </PermissionGate>
  );
}
