import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api/errors";
import { ReportApiError } from "../../lib/errors";
import type { MetricResult, ReportDetail, ReportSnapshotPayload } from "../../types";

const h = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  access: { canRead: true, canCreate: true, canDelete: false, canViewFinance: false, canUseFeature: true },
}));

vi.mock("../../hooks/use-report", () => ({ useReport: () => h.query }));
vi.mock("../../hooks/use-reports-access", () => ({ useReportsAccess: () => h.access }));
vi.mock("../../hooks/use-download-report", () => ({ useDownloadReport: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock("../../hooks/use-delete-report", () => ({ useDeleteReport: () => ({ mutateAsync: vi.fn(), isPending: false }) }));
vi.mock("../../hooks/use-retry-report", () => ({
  useRetryReport: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="chart" /> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ReportDetailView } from "./report-detail-view";

const value = (v: number, unit = "L") => ({ state: "value" as const, value: v, unit });

const base: ReportDetail = {
  id: "rep1",
  type: "WEEKLY",
  origin: "SCHEDULED",
  status: "COMPLETED",
  templateVersion: 1,
  period: { startDate: "2026-10-12", endDate: "2026-10-18", timezone: "Asia/Dhaka" },
  scope: { kind: "ALL_ELIGIBLE" },
  selectedMetricIds: [],
  includesFinance: false,
  hasPdf: true,
  pdfBytes: 1000,
  attempts: 1,
  errorCategory: null,
  errorMessage: "RAW BACKEND TEXT",
  createdAt: "2026-10-19T00:00:00Z",
  startedAt: null,
  completedAt: null,
  expiresAt: null,
  payload: null,
};

const metric = (over: Partial<MetricResult> & Pick<MetricResult, "metricId" | "value">): MetricResult => ({
  source: null,
  comparison: null,
  requiresPermission: null,
  ...over,
});

function payload(over: Partial<ReportSnapshotPayload> = {}): ReportSnapshotPayload {
  return {
    schemaVersion: 1,
    reportType: "WEEKLY",
    calcVersion: 1,
    templateVersion: 1,
    farm: { id: "f", name: "Green Farm", timezone: "Asia/Dhaka" },
    period: { start: "", end: "", startDate: "2026-10-12", endDate: "2026-10-18", timezone: "Asia/Dhaka", label: "" },
    previousPeriod: { start: "", end: "", startDate: "2026-10-05", endDate: "2026-10-11", timezone: "Asia/Dhaka", label: "" },
    scope: { kind: "ALL_ELIGIBLE" },
    generatedAt: "2026-10-19T04:00:00Z",
    includesFinance: false,
    sections: [
      {
        id: "health",
        domain: "health",
        titleKey: "reports.section.health",
        metrics: [metric({ metricId: "health.cases_opened", value: value(3, "cases") })],
      },
      {
        id: "milk",
        domain: "milk",
        titleKey: "reports.section.milk",
        metrics: [
          metric({ metricId: "milk.total_yield", value: value(120.5) }),
          metric({ metricId: "milk.avg_daily_yield", value: { state: "missing", reason: "x" } }),
          metric({ metricId: "milk.cows_with_data", value: { state: "not_calculated", reason: "y" } }),
          metric({ metricId: "milk.expected_cow_days", value: { state: "not_applicable" } }),
        ],
      },
    ],
    exceptions: [],
    dataQuality: {
      coverage: { expected: 10, recorded: 7 },
      notes: ["reports.dq.incomplete_coverage"],
      flags: {
        incompleteCoverage: true,
        hasUnsubmittedDrafts: false,
        hasEstimatedValues: false,
        hasUnknownCosts: false,
        groupMembershipCurrentOnly: false,
      },
    },
    ...over,
  };
}

function renderView() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
      <TooltipProvider>
        <ReportDetailView id="rep1" />
      </TooltipProvider>
    </NextIntlClientProvider>,
  );
}

const setQuery = (data: ReportDetail | undefined, extra: Record<string, unknown> = {}) => {
  h.query = { data, isError: false, error: null, pollTimedOut: false, isFetching: false, refetch: vi.fn(), ...extra };
};

beforeEach(() => {
  h.access = { canRead: true, canCreate: true, canDelete: false, canViewFinance: false, canUseFeature: true };
  setQuery(undefined);
});

describe("ReportDetailView states", () => {
  it("shows a skeleton while loading", () => {
    setQuery(undefined);
    renderView();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });

  it("shows the same generic message for a 404", () => {
    const err = new ReportApiError(new ApiError("NOT_FOUND" as never, "nf", 404));
    setQuery(undefined, { isError: true, error: err });
    renderView();
    expect(screen.getByRole("heading", { name: "Report not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to reports/ })).toHaveAttribute("href", "/reports");
  });

  it("shows the no-access state on a reasonless 403", () => {
    const err = new ReportApiError(new ApiError("FORBIDDEN" as never, "no", 403));
    setQuery(undefined, { isError: true, error: err });
    renderView();
    expect(screen.getByRole("heading", { name: "You cannot open reports" })).toBeInTheDocument();
  });

  it.each([
    ["QUEUED", "Your report is in the queue"],
    ["PROCESSING", "Your report is being generated"],
  ] as const)("%s shows the progress state", (status, title) => {
    setQuery({ ...base, status });
    renderView();
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByText(/usually takes under a minute/)).toBeInTheDocument();
  });

  it("a timed-out poll offers a manual refresh", () => {
    setQuery({ ...base, status: "PROCESSING" }, { pollTimedOut: true });
    renderView();
    expect(screen.getByText("This is taking longer than usual")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Refresh/ })).toBeInTheDocument();
  });

  it("FAILED shows the category message, never the raw backend text, and a retry", () => {
    setQuery({ ...base, status: "FAILED", errorCategory: "RENDER_FAILED" });
    renderView();
    expect(screen.getByText("The PDF could not be created.")).toBeInTheDocument();
    expect(screen.queryByText("RAW BACKEND TEXT")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("ReportDetailView completed report", () => {
  it("keeps the payload section order", () => {
    setQuery({ ...base, payload: payload() });
    renderView();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((n) => n.textContent);
    expect(headings.indexOf("Health")).toBeGreaterThanOrEqual(0);
    expect(headings.indexOf("Health")).toBeLessThan(headings.indexOf("Milk"));
  });

  it("never renders 0 for missing / not-calculated / not-applicable", () => {
    setQuery({ ...base, payload: payload() });
    renderView();
    const get = (id: string) => document.querySelector(`[data-metric-id="${id}"]`) as HTMLElement;
    expect(within(get("milk.avg_daily_yield")).getByText("Not recorded")).toBeInTheDocument();
    expect(within(get("milk.cows_with_data")).getByText("Not calculated")).toBeInTheDocument();
    expect(within(get("milk.expected_cow_days")).getByText("—")).toBeInTheDocument();
    for (const id of ["milk.avg_daily_yield", "milk.cows_with_data", "milk.expected_cow_days"]) {
      expect(get(id).textContent).not.toMatch(/(^|\s)0(\s|$)/);
    }
    expect(within(get("milk.total_yield")).getByText(/120\.5/)).toBeInTheDocument();
  });

  it("renders a null percent change as an em dash, and a real one signed", () => {
    const m1 = metric({
      metricId: "milk.total_yield",
      value: value(10),
      comparison: { current: value(10), previous: value(0), absoluteChange: 10, percentChange: null, previousState: "value" },
    });
    const m2 = metric({
      metricId: "milk.avg_daily_yield",
      value: value(12),
      comparison: { current: value(12), previous: value(10), absoluteChange: 2, percentChange: 20, previousState: "value" },
    });
    setQuery({
      ...base,
      payload: payload({ sections: [{ id: "milk", domain: "milk", titleKey: "reports.section.milk", metrics: [m1, m2] }] }),
    });
    renderView();
    const c1 = document.querySelector('[data-metric-id="milk.total_yield"]') as HTMLElement;
    const c2 = document.querySelector('[data-metric-id="milk.avg_daily_yield"]') as HTMLElement;
    expect(within(c1).getByLabelText(/vs previous period: \+10 L, —/)).toBeInTheDocument();
    expect(within(c2).getByLabelText(/\+2 L, \+20%/)).toBeInTheDocument();
  });

  it("series shows gaps count and a text alternative; rows label a removed animal", () => {
    const series = metric({
      metricId: "milk.daily_yield",
      value: value(30),
      series: [
        { key: "2026-10-12", value: value(10) },
        { key: "2026-10-13", value: { state: "missing", reason: "no" } },
        { key: "2026-10-14", value: value(20) },
      ],
    });
    const rows = metric({
      metricId: "milk.cow_total_yield",
      value: value(30),
      rows: [
        { key: "c1234567890123456789012345", label: null, value: value(20), source: null },
        { key: "tag1", label: "A-12 Lali", value: value(10), source: null },
      ],
    });
    setQuery({
      ...base,
      payload: payload({ sections: [{ id: "milk", domain: "milk", titleKey: "reports.section.milk", metrics: [series, rows] }] }),
    });
    renderView();
    expect(screen.getByText("1 day has no record")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /2 of 3 days recorded/ })).toBeInTheDocument();
    expect(screen.getByText("Animal (removed)")).toBeInTheDocument();
    expect(screen.getByText("A-12 Lali")).toBeInTheDocument();
  });

  it("shows the restricted-finance notice only when finance is absent AND the viewer can view finance", () => {
    h.access.canViewFinance = false;
    setQuery({ ...base, payload: payload({ includesFinance: false }) });
    const { unmount } = renderView();
    expect(screen.queryByTestId("finance-notice")).not.toBeInTheDocument();
    unmount();

    h.access.canViewFinance = true;
    const second = renderView();
    expect(screen.getByTestId("finance-notice")).toBeInTheDocument();
    second.unmount();

    setQuery({ ...base, payload: payload({ includesFinance: true }) });
    renderView();
    expect(screen.queryByTestId("finance-notice")).not.toBeInTheDocument();
  });

  it("offers delete only with the delete permission; download disabled without a PDF", () => {
    setQuery({ ...base, hasPdf: false, payload: payload() });
    const { unmount } = renderView();
    expect(screen.queryByRole("button", { name: /Delete/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download PDF/ })).toHaveAttribute("aria-disabled", "true");
    unmount();

    h.access.canDelete = true;
    setQuery({ ...base, hasPdf: true, payload: payload() });
    renderView();
    expect(screen.getByRole("button", { name: /Delete/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download PDF/ })).toBeEnabled();
  });

  it("translates data-quality notes and does not repeat a flag a note already explains", () => {
    setQuery({ ...base, payload: payload() });
    renderView();
    expect(screen.getAllByText(/Some expected records were not entered/)).toHaveLength(1);
    expect(screen.getByText("7 of 10 expected records entered")).toBeInTheDocument();
  });
});
