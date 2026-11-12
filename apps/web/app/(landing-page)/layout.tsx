import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Footer } from "./_components/footer";
import { LandingNav } from "./_components/landing-nav";

/**
 * Public marketing layout — served at the site root (future rakhal.app; the farm app will move
 * behind farm.rakhal.app via host-based rewrites in proxy.ts when domains exist — see
 * PROJECT_PROGRESS.md RFE-100 notes). Full SEO metadata, indexable.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing.meta");
  return {
    title: { absolute: t("title") },
    description: t("description"),
    openGraph: {
      title: t("title"),
      description: t("description"),
      type: "website",
      siteName: "Rakhal",
    },
  };
}

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LandingNav />
      <main>{children}</main>
      <Footer />
    </>
  );
}
