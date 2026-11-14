"use client"; // local dialog-open state only

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@rakhal/ui/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rakhal/ui/ui/table";
import { Button } from "@rakhal/ui/ui/button";
import { Can } from "@/lib/auth/permissions";
import { RecordColostrumDialog } from "../dialogs/record-colostrum-dialog";
import type { CalfDetail } from "../../types";

export function ColostrumTab({ calfId, data }: { calfId: string; data: CalfDetail }) {
  const t = useTranslations("calves.detail.colostrum");
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <StatCard label={t("total24h")} value={t("ml", { value: data.totalColostrum24hMl })} className="max-w-xs" />
        <Can I="calf.log-feeding">
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" aria-hidden />
            {t("logColostrum")}
          </Button>
        </Can>
      </div>
      {data.colostrumRecords.length === 0 ? (
        <EmptyState title={t("empty")} className="py-10" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.feedNumber")}</TableHead>
              <TableHead>{t("columns.fedAt")}</TableHead>
              <TableHead>{t("columns.volumeMl")}</TableHead>
              <TableHead>{t("columns.quality")}</TableHead>
              <TableHead>{t("columns.fedBy")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.colostrumRecords.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.feedNumber}</TableCell>
                <TableCell>
                  <DateText date={r.fedAt} />
                </TableCell>
                <TableCell>{r.volumeMl} ml</TableCell>
                <TableCell>{t(`qualityValue.${r.quality}`)}</TableCell>
                <TableCell>{r.fedBy ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <RecordColostrumDialog calfId={calfId} open={open} onOpenChange={setOpen} />
    </div>
  );
}
