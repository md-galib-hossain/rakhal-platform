import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@/components/shared/page-card";
import { MilkOverviewCard } from "@/features/milk/components/milk-overview-card";
import { MilkTrendChart } from "@/features/milk/components/milk-trend-chart";
import { MilkSessionLog } from "@/features/milk/components/milk-session-log";
import { MilkAnomaliesPanel } from "@/features/milk/components/milk-anomalies-panel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("milk")} — Rakhal`, robots: { index: false } };
}

/**
 * RFE-025 — Milk log page (PRD §10, API §6 minus `/milk/quality` — V1.5, backend not built).
 * Overview KPIs + 30-day trend (`GET /milk/overview`, one query shared by both widgets), the
 * session log grid (`GET/POST /milk/log`, `POST /milk/submit`), and the anomaly review list
 * (`GET /milk/anomalies`, `POST /milk/anomalies/:id/review`) — all real backend routes, verified
 * directly against `milk.controller.ts`/`milk.service.ts`, not the aspirational API doc. Wrapped
 * in the shared `PageCard` (2026-07-11 pattern) matching `/dashboard` and `/cattle`.
 */
export default async function MilkPage() {
  const t = await getTranslations("nav");

  return (
    <PageCard title={t("milk")}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MilkOverviewCard />
        <MilkTrendChart />
        <MilkSessionLog />
        <MilkAnomaliesPanel />
      </div>
    </PageCard>
  );
}
