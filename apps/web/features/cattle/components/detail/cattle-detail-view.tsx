"use client"; // live query + edit dialog state

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { Can } from "@/lib/auth/permissions";
import { useCattleDetail } from "../../hooks/use-cattle";
import { CattleFormDialog } from "../cattle-form-dialog";
import { CattleProfileCard } from "./cattle-profile-card";
import { CattleDetailTabs } from "./cattle-detail-tabs";

/** RFE-023 — Cattle detail page shell: fetches `GET /cattle/:id` (same query the RFE-022 edit
 * dialog already uses, `useCattleDetail`), renders the profile card + 5-tab body, and owns the
 * "Edit" trigger for the same `CattleFormDialog` the list's row-actions menu uses. */
export function CattleDetailView({ cattleId }: { cattleId: string }) {
  const t = useTranslations("cattle.detail");
  const query = useCattleDetail(cattleId);
  const [editOpen, setEditOpen] = useState(false);

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <CardSkeleton lines={3} />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return <ErrorState description={t("error")} onRetry={() => query.refetch()} />;
  }
  const cattle = query.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/cattle">
            <ArrowLeft className="size-4" aria-hidden />
            {t("back")}
          </Link>
        </Button>
        <Can I="cattle.update">
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" aria-hidden />
            {t("editProfile")}
          </Button>
        </Can>
      </div>

      <CattleProfileCard cattle={cattle} />
      <CattleDetailTabs cattleId={cattleId} gender={cattle.gender} />

      <CattleFormDialog open={editOpen} onOpenChange={setEditOpen} cattle={cattle} />
    </div>
  );
}
