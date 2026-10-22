import { PageHeader } from "@rakhal/ui/shared/page-header";
import { CreateFlagForm, FlagToggle, SaveSettingForm } from "@/components/config/config-forms";
import { DetailSection, pageSurface, TableShell, td, th } from "@/components/directory/detail-list";
import { StatusBadge } from "@/components/directory/status-badge";
import { getFlags, getSettings } from "@/lib/api/directory";
import { PermissionGate } from "@/lib/auth/permission-gate";
import { getSession } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { canDo } from "@/lib/permissions";

export default function ConfigPage() {
  return (
    <PermissionGate perm="config.read">
      <ConfigOverview />
    </PermissionGate>
  );
}

async function ConfigOverview() {
  const session = await getSession();
  const canManage = canDo(session?.permissions ?? [], "config.manage");
  const [flags, settings] = await Promise.all([getFlags(), getSettings()]);

  return (
    <div className={pageSurface}>
      <PageHeader
        title="Config"
        description="Feature flags and platform settings. Every change needs a reason and is recorded in the audit log."
      />

      <DetailSection title="Feature flags">
        {flags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No flags yet.</p>
        ) : (
          <TableShell caption="Feature flags">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                <th className={th}>Flag</th>
                <th className={th}>State</th>
                <th className={th}>Pilot farms</th>
                <th className={th}>Updated</th>
                {canManage ? <th className={th}>Action</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {flags.map((f) => (
                <tr key={f.id}>
                  <td className={td}>
                    <p className="font-medium">{f.key}</p>
                    {f.description ? <p className="text-xs text-muted-foreground">{f.description}</p> : null}
                  </td>
                  <td className={td}>
                    <StatusBadge status={f.enabled ? "ON" : "OFF"} />
                  </td>
                  <td className={td}>{f.farmIds.length === 0 ? "-" : `${f.farmIds.length} farm${f.farmIds.length === 1 ? "" : "s"}`}</td>
                  <td className={`${td} whitespace-nowrap`}>{formatDateTime(f.updatedAt)}</td>
                  {canManage ? (
                    <td className={td}>
                      <FlagToggle flagKey={f.key} enabled={f.enabled} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
        {canManage ? (
          <div className="mt-4 border-t border-border pt-4">
            <h3 className="mb-2 text-sm font-semibold">New flag</h3>
            <CreateFlagForm />
          </div>
        ) : null}
      </DetailSection>

      <DetailSection title="Platform settings">
        {settings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No settings yet.</p>
        ) : (
          <TableShell caption="Platform settings">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                <th className={th}>Setting</th>
                <th className={th}>Value</th>
                <th className={th}>Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {settings.map((s) => (
                <tr key={s.key}>
                  <td className={td}>
                    <p className="font-medium">{s.key}</p>
                    {s.description ? <p className="text-xs text-muted-foreground">{s.description}</p> : null}
                  </td>
                  <td className={td}>
                    <code className="break-all text-xs">{JSON.stringify(s.value)}</code>
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{formatDateTime(s.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
        {canManage ? (
          <div className="mt-4 border-t border-border pt-4">
            <h3 className="mb-2 text-sm font-semibold">Set a value</h3>
            <SaveSettingForm />
          </div>
        ) : null}
      </DetailSection>
    </div>
  );
}
