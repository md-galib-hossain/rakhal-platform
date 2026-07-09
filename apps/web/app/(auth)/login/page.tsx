import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

// Placeholder — the real login page (form + BFF auth) lands in RFE-006 after RFE-003.
export default function LoginPage() {
  const t = useTranslations("authPlaceholder");
  const tc = useTranslations("common");
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-2xl font-bold">{t("comingSoon")}</h1>
      <p className="max-w-md text-muted-foreground">{t("loginSoonBody")}</p>
      <Button variant="secondary" asChild>
        <Link href="/">{tc("back")}</Link>
      </Button>
    </div>
  );
}
