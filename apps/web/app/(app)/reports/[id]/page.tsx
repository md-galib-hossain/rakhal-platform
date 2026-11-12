import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ReportDetailView } from "@/features/reports/components/detail";

/**
 * Server shell: resolves the async `params`, validates the id shape (a malformed id is a plain 404, no request
 * made) and sets the metadata. The body is a client component because it polls `GET /reports/:id` while the
 * report is generating.
 */
const ID_SHAPE = /^[A-Za-z0-9_-]{1,64}$/;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reportsDetail");
  return { title: `${t("pageTitle")} — Rakhal`, robots: { index: false } };
}

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_SHAPE.test(id)) notFound();
  return <ReportDetailView id={id} />;
}
