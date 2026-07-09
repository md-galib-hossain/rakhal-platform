import { getTranslations } from "next-intl/server";
import { Counters } from "./_components/counters";
import { DashboardPreview } from "./_components/dashboard-preview";
import { Faq } from "./_components/faq";
import { Features } from "./_components/features";
import { FinalCta } from "./_components/final-cta";
import { Hero } from "./_components/hero";
import { Onboarding } from "./_components/onboarding";
import { Pricing } from "./_components/pricing";
import { Problem } from "./_components/problem";
import { Solution } from "./_components/solution";
import { Testimonials } from "./_components/testimonials";

export default async function LandingPage() {
  // FAQ structured data for rich results — built from the same message catalogue as the visible FAQ.
  const t = await getTranslations("landing.faq");
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: Array.from({ length: 10 }, (_, i) => ({
      "@type": "Question",
      name: t(`q${i + 1}`),
      acceptedAnswer: { "@type": "Answer", text: t(`a${i + 1}`) },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Safe: JSON.stringify over our own static message catalogue, no user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Hero />
      <Counters />
      <Problem />
      <Solution />
      <Features />
      <Onboarding />
      <DashboardPreview />
      <Testimonials />
      <Pricing />
      <Faq />
      <FinalCta />
    </>
  );
}
