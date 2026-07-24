"use client"; // filter reads (searchParams), paged query, dialog state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { useBuyersPagedList, useDispatchesPagedList } from "../hooks/use-buyers";
import { DispatchTable } from "./dispatch-table";
import { RecordDispatchDialog } from "./record-dispatch-dialog";
import { FilterBar } from "@/components/shared/filter-bar";

/** Dispatch History tab body — every dispatch across all buyers (filterable by buyer), plus a
 * standalone "Record Dispatch" entry point that isn't tied to a specific buyer row. */
export function DispatchesView() {
  const t = useTranslations("buyers.dispatchHistory");
  const searchParams = useSearchParams();
  const buyersList = useBuyersPagedList({});
  const filters = { buyerId: searchParams.get("buyerId") ?? undefined };
  const query = useDispatchesPagedList(filters);
  const [recordOpen, setRecordOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar
          layout="split"
          selects={[
            {
              key: "buyerId",
              label: t("buyerFilter"),
              options: buyersList.items.map((b) => ({ value: b.id, label: b.name })),
            },
          ]}
        />
        <Button variant="primary" className="gap-2" onClick={() => setRecordOpen(true)}>
          <Plus className="size-[18px]" aria-hidden />
          {t("recordDispatch")}
        </Button>
      </div>

      <DispatchTable items={query.items} isLoading={query.isLoading} isError={query.isError} onRetry={() => void query.refetch()} />

      <Pagination
        page={query.page}
        totalPages={query.totalPages}
        onPageChange={query.goToPage}
        isFetching={query.isFetching}
        pageSize={query.pageSize}
        onPageSizeChange={query.setPageSize}
      />

      <RecordDispatchDialog buyer={null} open={recordOpen} onOpenChange={setRecordOpen} />
    </div>
  );
}
