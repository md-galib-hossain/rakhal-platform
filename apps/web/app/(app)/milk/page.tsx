import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@/components/shared/page-card";
import { MilkKeyMetricsCard } from "@/features/milk/components/milk-key-metrics-card";
import { MilkTrendChart } from "@/features/milk/components/milk-trend-chart";
import { MilkLogSection } from "@/features/milk/components/milk-log-section";
import { MilkAnomaliesPanel } from "@/features/milk/components/milk-anomalies-panel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("milk")} — Rakhal`, robots: { index: false } };
}

/**
 * RFE-025 — Milk log page (Figma node 734:32300, PRD §10, API §6 minus `/milk/quality` — V1.5,
 * backend not built). Key metrics + production trend (`GET /milk/overview`, one query shared by
 * both widgets), the milk log grid (`GET/POST /milk/log`, `POST /milk/submit`) with all of the
 * farm's configured sessions as columns at once rather than a per-session tab switcher, and the
 * anomaly review list (`GET /milk/anomalies`, `POST /milk/anomalies/:id/review`) — kept below the
 * log even though the Figma page doesn't include it, since it's live worker-facing functionality,
 * not a mock. All real backend routes, verified directly against `milk.controller.ts`/
 * `milk.service.ts`, not the aspirational API doc. Wrapped in the shared `PageCard`.
 */
export default async function MilkPage() {
  const t = await getTranslations("nav");

  return (
    <PageCard title={t("milk")}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <MilkKeyMetricsCard />
        </div>
        <div className="lg:col-span-3">
          <MilkTrendChart />
        </div>
        <MilkLogSection />
        <MilkAnomaliesPanel />
      </div>
    </PageCard>
  );
}
