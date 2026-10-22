import { PageHeader } from "@rakhal/ui/shared/page-header";
import { DetailSection, pageSurface, TableShell, td, th } from "@/components/directory/detail-list";
import { StatusBadge } from "@/components/directory/status-badge";
import { RetryJobButton } from "@/components/system/retry-button";
import { getCrons, getEmailStatus, getFailedJobs, getIntegrations, getQueues } from "@/lib/api/directory";
import { PermissionGate } from "@/lib/auth/permission-gate";
import { getSession } from "@/lib/auth/session";
import { formatCount, formatDateTime, TIME_ZONE_LABEL } from "@/lib/format";
import { canDo } from "@/lib/permissions";

export default function SystemPage() {
  return (
    <PermissionGate perm="system.read">
      <SystemOverview />
    </PermissionGate>
  );
}

async function SystemOverview() {
  const session = await getSession();
  const canRetry = canDo(session?.permissions ?? [], "system.manage");
  const [integrations, queues, email, crons] = await Promise.all([
    getIntegrations(),
    getQueues(),
    getEmailStatus(),
    getCrons(),
  ]);
  const failedByQueue = await Promise.all(
    queues.queues.filter((q) => q.counts.failed > 0).map((q) => getFailedJobs(q.name)),
  );
  const windows: [string, Record<string, number>][] = [
    ["Last 24 hours", email.last24h],
    ["Last 7 days", email.last7d],
  ];

  return (
    <div className={pageSurface}>
      <PageHeader
        title="System"
        description={`Live health of the platform. Checked ${formatDateTime(integrations.checkedAt)} (${TIME_ZONE_LABEL}). Only whether something is configured is shown, never its value.`}
      />

      <DetailSection title="Integrations">
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {integrations.items.map((item) => (
            <li key={item.key} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{item.label}</span>
                <StatusBadge status={item.status.toUpperCase()} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.detail}
                {item.latencyMs !== undefined ? ` (${item.latencyMs} ms)` : ""}
              </p>
            </li>
          ))}
        </ul>
      </DetailSection>

      <DetailSection title="Queues">
        <TableShell caption="Background job queues">
          <thead className="border-b border-border bg-muted/40 text-left">
            <tr>
              <th className={th}>Queue</th>
              <th className={th}>Waiting</th>
              <th className={th}>Active</th>
              <th className={th}>Delayed</th>
              <th className={th}>Failed</th>
              <th className={th}>State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {queues.queues.map((q) => (
              <tr key={q.name}>
                <td className={`${td} font-medium`}>{q.name}</td>
                <td className={td}>{formatCount(q.counts.waiting)}</td>
                <td className={td}>{formatCount(q.counts.active)}</td>
                <td className={td}>{formatCount(q.counts.delayed)}</td>
                <td className={td}>
                  {q.counts.failed > 0 ? <StatusBadge status="DEGRADED" /> : null} {formatCount(q.counts.failed)}
                </td>
                <td className={td}>{q.paused ? <StatusBadge status="SUSPENDED" /> : "Running"}</td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </DetailSection>

      {failedByQueue.map(({ queue, jobs }) => (
        <DetailSection key={queue} title={`Failed jobs: ${queue}`}>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">None.</p>
          ) : (
            <TableShell caption={`Failed jobs in ${queue}`}>
              <thead className="border-b border-border bg-muted/40 text-left">
                <tr>
                  <th className={th}>Job</th>
                  <th className={th}>Attempts</th>
                  <th className={th}>Failed at</th>
                  <th className={th}>Reason</th>
                  {canRetry ? <th className={th}>Action</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jobs.map((job) => (
                  <tr key={job.id ?? job.createdAt}>
                    <td className={td}>
                      <p className="font-medium">{job.name}</p>
                      <p className="text-xs text-muted-foreground">#{job.id}</p>
                    </td>
                    <td className={td}>{job.attemptsMade}</td>
                    <td className={`${td} whitespace-nowrap`}>{formatDateTime(job.failedAt)}</td>
                    <td className={`${td} max-w-xs break-words text-xs`}>{job.failedReason || "-"}</td>
                    {canRetry ? (
                      <td className={td}>{job.id ? <RetryJobButton queue={queue} jobId={job.id} /> : null}</td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </DetailSection>
      ))}

      <DetailSection title={`Email delivery (${email.provider})`}>
        <div className="grid gap-4 sm:grid-cols-2">
          {windows.map(([label, counts]) => (
            <div key={label}>
              <p className="mb-1 text-xs text-muted-foreground">{label}</p>
              <ul className="divide-y divide-border text-sm">
                {["SENT", "QUEUED", "PROCESSING", "FAILED"].map((s) => (
                  <li key={s} className="flex items-center justify-between py-1.5">
                    <span className="capitalize">{s.toLowerCase()}</span>
                    <span className={s === "FAILED" && (counts[s] ?? 0) > 0 ? "font-medium text-destructive" : "font-medium"}>
                      {formatCount(counts[s] ?? 0)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {email.recentFailures.length > 0 ? (
          <div className="mt-4">
            <p className="mb-1 text-xs text-muted-foreground">Recent failures (recipients are masked)</p>
            <TableShell caption="Recent failed emails">
              <thead className="border-b border-border bg-muted/40 text-left">
                <tr>
                  <th className={th}>To</th>
                  <th className={th}>Template</th>
                  <th className={th}>Retries</th>
                  <th className={th}>Error</th>
                  <th className={th}>When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {email.recentFailures.map((f) => (
                  <tr key={f.id}>
                    <td className={td}>{f.to}</td>
                    <td className={td}>{f.template}</td>
                    <td className={td}>{f.retries}</td>
                    <td className={`${td} max-w-xs break-words text-xs`}>{f.error || "-"}</td>
                    <td className={`${td} whitespace-nowrap`}>{formatDateTime(f.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          </div>
        ) : null}
      </DetailSection>

      <DetailSection title="Scheduled jobs">
        <TableShell caption="Cron jobs">
          <thead className="border-b border-border bg-muted/40 text-left">
            <tr>
              <th className={th}>Job</th>
              <th className={th}>State</th>
              <th className={th}>Next run</th>
              <th className={th}>Last run</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {crons.crons.map((c) => (
              <tr key={c.name}>
                <td className={`${td} font-medium`}>{c.name}</td>
                <td className={td}>{c.running ? "Active" : <StatusBadge status="SUSPENDED" />}</td>
                <td className={`${td} whitespace-nowrap`}>{formatDateTime(c.next_run)}</td>
                <td className={`${td} whitespace-nowrap`}>{formatDateTime(c.last_run)}</td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </DetailSection>
    </div>
  );
}
