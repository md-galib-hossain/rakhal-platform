"use client"; // mutation

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { ConfirmDialog } from "@rakhal/ui/shared/confirm-dialog";
import { useArchiveFinancialAccount } from "../../hooks/use-finance-v2";
import type { FinancialAccount } from "../../types-v2";

/** RAKHAL-356 — archive (never hard-delete) a Financial Account, via the shared `ConfirmDialog`. */
export function ArchiveAccountDialog({
  account,
  open,
  onOpenChange,
}: {
  account: FinancialAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("finance.accountsPage.archiveDialog");
  const archiveAccount = useArchiveFinancialAccount();

  async function handleConfirm() {
    if (!account) return;
    try {
      await archiveAccount.mutateAsync(account.id);
      toast.success(t("successToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={account ? t("description", { name: account.name }) : undefined}
      confirmLabel={t("confirm")}
      cancelLabel={t("cancel")}
      variant="destructive"
      onConfirm={handleConfirm}
    />
  );
}
