"use client"; // local dialog-open state only

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { EmptyState } from "@rakhal/ui/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rakhal/ui/ui/table";
import { Button } from "@rakhal/ui/ui/button";
import { Can } from "@/lib/auth/permissions";
import { RecordMilkFeedingDialog } from "../dialogs/record-milk-feeding-dialog";
import type { CalfDetail } from "../../types";

export function MilkFeedingTab({ calfId, data }: { calfId: string; data: CalfDetail }) {
  const t = useTranslations("calves.detail.milk");
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Can I="calf.log-feeding">
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" aria-hidden />
            {t("logFeeding")}
          </Button>
        </Can>
      </div>
      {data.milkFeedingLog.length === 0 ? (
        <EmptyState title={t("empty")} className="py-10" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.date")}</TableHead>
              <TableHead>{t("columns.morning")}</TableHead>
              <TableHead>{t("columns.evening")}</TableHead>
              <TableHead>{t("columns.total")}</TableHead>
              <TableHead>{t("columns.type")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.milkFeedingLog.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <DateText date={r.date} />
                </TableCell>
                <TableCell>{r.morningMl} ml</TableCell>
                <TableCell>{r.eveningMl} ml</TableCell>
                <TableCell className="font-medium text-success">{r.totalMl} ml</TableCell>
                <TableCell>{t(`typeValue.${r.type}`)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <RecordMilkFeedingDialog calfId={calfId} open={open} onOpenChange={setOpen} />
    </div>
  );
}
