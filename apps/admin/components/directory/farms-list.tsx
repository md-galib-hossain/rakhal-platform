"use client"; // columns are render functions, which cannot cross the server/client boundary

import Link from "next/link";
import type { FarmRow, Page } from "@/lib/api/directory";
import { formatDate, formatLocation } from "@/lib/format";
import { InfiniteDirectory, type Column } from "./infinite-directory";
import { StatusBadge } from "./status-badge";

const columns: Column<FarmRow>[] = [
  {
    header: "Farm",
    cell: (farm) => (
      <>
        <Link href={`/farms/${farm.id}`} className="font-medium text-foreground underline-offset-2 hover:underline">
          {farm.name}
        </Link>
        {farm.farmCode ? <p className="text-xs text-muted-foreground">{farm.farmCode}</p> : null}
      </>
    ),
  },
  {
    header: "Owner",
    cell: (farm) => (
      <>
        <p>{farm.owner.name}</p>
        <p className="text-xs text-muted-foreground">{farm.owner.email}</p>
      </>
    ),
  },
  { header: "Location", cell: (farm) => formatLocation(farm.district, farm.division) },
  { header: "Status", cell: (farm) => <StatusBadge status={farm.status} /> },
  {
    header: "Plan",
    cell: (farm) =>
      farm.subscription ? (
        <div className="flex flex-col items-start gap-1">
          <span>{farm.subscription.subscriptionPlan.name}</span>
          <StatusBadge status={farm.subscription.status} />
        </div>
      ) : (
        "-"
      ),
  },
  { header: "Members", cell: (farm) => <span className="tabular-nums">{farm.memberCount}</span> },
  { header: "Cattle", cell: (farm) => <span className="tabular-nums">{farm.cattleCount}</span> },
  { header: "Created", cell: (farm) => formatDate(farm.createdAt) },
];

export function FarmsList({ initial, params }: { initial: Page<FarmRow>; params: { search?: string; status?: string } }) {
  return (
    <InfiniteDirectory
      resource="farms"
      params={params}
      initial={initial}
      caption="Farms"
      columns={columns}
      mobile={(farm) => ({
        title: <Link href={`/farms/${farm.id}`}>{farm.name}</Link>,
        subtitle: farm.owner.email,
        badges: (
          <>
            <StatusBadge status={farm.status} />
            {farm.subscription ? <StatusBadge status={farm.subscription.status} /> : null}
          </>
        ),
        fields: [
          { label: "Owner", value: farm.owner.name },
          { label: "Location", value: formatLocation(farm.district, farm.division) },
          { label: "Plan", value: farm.subscription?.subscriptionPlan.name ?? "-" },
          { label: "Members", value: farm.memberCount },
          { label: "Cattle", value: farm.cattleCount },
        ],
      })}
    />
  );
}
