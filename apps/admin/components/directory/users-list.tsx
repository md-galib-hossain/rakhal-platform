"use client"; // columns are render functions, which cannot cross the server/client boundary

import Link from "next/link";
import type { Page, UserRow } from "@/lib/api/directory";
import { formatDate, formatDateTime } from "@/lib/format";
import { InfiniteDirectory, type Column } from "./infinite-directory";
import { StatusBadge } from "./status-badge";

function accountState(u: UserRow) {
  if (u.isBlocked) return <StatusBadge status="BLOCKED" />;
  if (u.lockedUntil && new Date(u.lockedUntil) > new Date()) return <StatusBadge status="SUSPENDED" />;
  return <span className="text-muted-foreground">OK</span>;
}

const columns: Column<UserRow>[] = [
  {
    header: "User",
    cell: (u) => (
      <>
        <Link href={`/users/${u.id}`} className="font-medium text-foreground underline-offset-2 hover:underline">
          {u.name}
        </Link>
        <p className="text-xs text-muted-foreground">{u.email}</p>
      </>
    ),
  },
  { header: "Email verified", cell: (u) => (u.isEmailVerified ? "Yes" : "No") },
  { header: "Farms", cell: (u) => <span className="tabular-nums">{u.farmCount}</span> },
  { header: "Account", cell: accountState },
  { header: "Last sign-in", cell: (u) => formatDateTime(u.lastLoginAt) },
  { header: "Joined", cell: (u) => formatDate(u.createdAt) },
];

export function UsersList({ initial, params }: { initial: Page<UserRow>; params: { search?: string } }) {
  return (
    <InfiniteDirectory
      resource="users"
      params={params}
      initial={initial}
      caption="Users"
      columns={columns}
      mobile={(u) => ({
        title: <Link href={`/users/${u.id}`}>{u.name}</Link>,
        subtitle: u.email,
        badges: accountState(u),
        fields: [
          { label: "Email verified", value: u.isEmailVerified ? "Yes" : "No" },
          { label: "Farms", value: u.farmCount },
          { label: "Last sign-in", value: formatDateTime(u.lastLoginAt) },
          { label: "Joined", value: formatDate(u.createdAt) },
        ],
      })}
    />
  );
}
