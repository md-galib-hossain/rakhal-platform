import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function ReportNotFound() {
  const t = await getTranslations("reportsDetail");
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="size-6 text-muted-foreground" aria-hidden />
      </div>
      <h1 className="text-lg font-semibold text-foreground">{t("notFound.title")}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{t("notFound.body")}</p>
      <Button asChild variant="outline" size="sm">
        <Link href="/reports">{t("back")}</Link>
      </Button>
    </div>
  );
}
