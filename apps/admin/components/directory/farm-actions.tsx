"use client";

import { ActionDialog } from "./action-dialog";

/** Farm suspend/reactivate. Hidden without `farm.manage`; the backend enforces the permission regardless. */
export function FarmActions({
  farmId,
  farmName,
  status,
  canManage,
}: {
  farmId: string;
  farmName: string;
  status: string;
  canManage: boolean;
}) {
  if (!canManage) return null;
  if (status === "ARCHIVED") return <p className="text-xs text-muted-foreground">Archived farms cannot be changed.</p>;

  return status === "SUSPENDED" ? (
    <ActionDialog
      key="farm.reactivate"
      kind="farm.reactivate"
      targetId={farmId}
      triggerLabel="Reactivate farm"
      title="Reactivate this farm?"
      description="Members can sign in to this farm and use it again immediately."
      confirmValue={farmName}
      confirmNoun="farm name"
      submitLabel="Reactivate farm"
    />
  ) : (
    <ActionDialog
      key="farm.suspend"
      kind="farm.suspend"
      targetId={farmId}
      triggerLabel="Suspend farm"
      title="Suspend this farm?"
      description="Every member is refused access to this farm on their very next request. Data is kept. You can reactivate it at any time."
      confirmValue={farmName}
      confirmNoun="farm name"
      submitLabel="Suspend farm"
      danger
    />
  );
}
