"use client"; // columns are render functions, which cannot cross the server/client boundary

import type { AuditRow, Page } from "@/lib/api/directory";
import { formatDateTime } from "@/lib/format";
import { InfiniteDirectory, type Column } from "./infinite-directory";
import { StatusBadge } from "./status-badge";

function hasPayload(value: unknown): boolean {
  return value !== null && value !== undefined && !(typeof value === "object" && Object.keys(value as object).length === 0);
}

function actor(row: AuditRow) {
  return row.actorEmail ?? (row.adminId ? <code className="text-xs">{row.adminId.slice(-8)}</code> : "-");
}

const columns: Column<AuditRow>[] = [
  { header: "When", cell: (row) => formatDateTime(row.createdAt) },
  { header: "Actor", cell: actor },
  {
    header: "Action",
    cell: (row) => (
      <>
        <p className="font-medium">{row.action}</p>
        {hasPayload(row.before) || hasPayload(row.after) || hasPayload(row.metadata) ? (
          <details className="mt-1 text-xs">
            <summary className="cursor-pointer text-muted-foreground">Details</summary>
            <pre className="mt-1 max-w-md overflow-x-auto whitespace-pre rounded bg-muted p-2">
              {JSON.stringify({ before: row.before, after: row.after, metadata: row.metadata }, null, 2)}
            </pre>
          </details>
        ) : null}
      </>
    ),
  },
  {
    header: "Target",
    cell: (row) => (
      <>
        {row.entityType}
        {row.entityId ? <p className="text-xs text-muted-foreground">{row.entityId.slice(-8)}</p> : null}
      </>
    ),
  },
  { header: "Outcome", cell: (row) => <StatusBadge status={row.outcome} /> },
  { header: "IP", cell: (row) => row.ipAddress ?? "-" },
];

export function AuditList({ initial, params }: { initial: Page<AuditRow>; params: { action?: string } }) {
  return (
    <InfiniteDirectory
      resource="audit"
      params={params}
      initial={initial}
      caption="Admin audit log"
      columns={columns}
      mobile={(row) => ({
        title: row.action,
        subtitle: formatDateTime(row.createdAt),
        badges: <StatusBadge status={row.outcome} />,
        fields: [
          { label: "Actor", value: actor(row) },
          { label: "Target", value: row.entityType },
          { label: "IP", value: row.ipAddress ?? "-" },
        ],
      })}
    />
  );
}
