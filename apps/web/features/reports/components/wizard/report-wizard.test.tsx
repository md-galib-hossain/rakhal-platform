import { createContext, useContext } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import { ApiError } from "@/lib/api/errors";

const push = vi.fn();
const createMutate = vi.fn();
const previewMutate = vi.fn();
const access = { canRead: true, canCreate: true, canDelete: false, canViewFinance: false, canUseFeature: true };
let templatesState: { isLoading: boolean; isError: boolean; data: unknown; refetch: () => void } = {
  isLoading: false,
  isError: false,
  data: undefined,
  refetch: vi.fn(),
};

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));
vi.mock("@/features/subscription/hooks/use-subscription", () => ({ useSubscription: () => ({ isLoading: false }) }));
vi.mock("@/features/cattle/hooks/use-cattle", () => ({
  useAnimalGroups: () => ({
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    data: { items: [{ id: "g1", name: "Dry cows", memberCount: 4 }] },
  }),
}));
vi.mock("@/components/shared/cattle-picker", () => ({
  CattlePicker: ({ onValueChange }: { onValueChange: (id: string) => void }) => (
    <button type="button" onClick={() => onValueChange("cow-9")}>
      pick-cow
    </button>
  ),
}));
vi.mock("@/components/shared/date-range-picker", () => ({
  DateRangePicker: ({ onRangeChange }: { onRangeChange: (a: Date, b: Date) => void }) => (
    <div>
      <button type="button" onClick={() => onRangeChange(new Date(2026, 0, 1), new Date(2026, 0, 10))}>
        pick-valid-range
      </button>
      <button type="button" onClick={() => onRangeChange(new Date(2025, 0, 1), new Date(2026, 5, 1))}>
        pick-long-range
      </button>
    </div>
  ),
}));
const SelectCtx = createContext<(v: string) => void>(() => {});
vi.mock("@/components/ui/select", () => ({
  Select: ({ onValueChange, children }: { onValueChange: (v: string) => void; children: React.ReactNode }) => (
    <SelectCtx.Provider value={onValueChange}>{children}</SelectCtx.Provider>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: function Item({ value, children }: { value: string; children: React.ReactNode }) {
    const on = useContext(SelectCtx);
    return (
      <button type="button" onClick={() => on(value)}>
        {children}
      </button>
    );
  },
}));
vi.mock("@/features/reports", async (orig) => {
  const actual = await orig<typeof import("@/features/reports")>();
  return {
    ...actual,
    useReportsAccess: () => access,
    useReportTemplates: () => templatesState,
    useCreateReport: () => ({ mutateAsync: createMutate, isPending: false }),
    usePreviewReport: () => ({ mutate: previewMutate, isPending: false, data: undefined, error: null }),
  };
});

import { ReportWizard } from "./report-wizard";
import { ReportApiError } from "@/features/reports";

const metric = (id: string, unit = "L") => ({
  id,
  unit,
  labelKey: `reports.metrics.${id}.label`,
  definitionKey: `reports.metrics.${id}.definition`,
  requiresFinance: id.startsWith("finance."),
});
const milk = { id: "milk", domain: "milk", titleKey: "reports.section.milk", metrics: [metric("milk.total_yield"), metric("milk.avg_daily_yield")] };
const health = { id: "health", domain: "health", titleKey: "reports.section.health", metrics: [metric("health.new_cases", "cases")] };
const finance = { id: "finance", domain: "finance", titleKey: "reports.section.finance", metrics: [metric("finance.total_expense", "BDT")] };

function catalogue(sections: unknown[]) {
  return {
    onDemand: { id: "t", alias: "on-demand", version: 1, domains: [], sections },
    scheduled: { weekly: null, monthly: null },
    datePresets: [],
    scopeKinds: [],
    limits: { maxMetrics: 60, maxCustomRangeDays: 366 },
  };
}

function renderWizard() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ReportWizard />
    </NextIntlClientProvider>,
  );
}

const next = () => userEvent.click(screen.getByRole("button", { name: "Continue" }));
const back = () => userEvent.click(screen.getByRole("button", { name: "Back" }));

async function openFigures(section: string) {
  const card = screen.getByTestId(`section-${section}`);
  await userEvent.click(within(card).getByRole("button", { name: /Choose figures/ }));
  return card;
}

const summary = (id: string) => ({
  id,
  status: "COMPLETED",
  period: { startDate: "2026-10-01", endDate: "2026-10-31", timezone: "Asia/Dhaka" },
  createdAt: "2026-10-24T05:00:00.000Z",
  completedAt: "2026-10-24T05:00:05.000Z",
});

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(access, { canCreate: true, canUseFeature: true });
  templatesState = { isLoading: false, isError: false, data: catalogue([milk, health]), refetch: vi.fn() };
});

describe("access gating", () => {
  it("shows a no-permission state without reports.create", () => {
    access.canCreate = false;
    renderWizard();
    expect(screen.getByText(/do not have permission to create reports/i)).toBeInTheDocument();
  });

  it("shows an upgrade notice (no redirect) when the plan lacks the feature", () => {
    access.canUseFeature = false;
    renderWizard();
    expect(screen.getByText("Reports are not in your plan")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows an error state with retry when the catalogue fails", async () => {
    templatesState = { ...templatesState, isError: true, data: undefined };
    renderWizard();
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(templatesState.refetch).toHaveBeenCalled();
  });
});

describe("catalogue step", () => {
  it("omits the finance section when the server catalogue does not contain it", () => {
    renderWizard();
    expect(screen.getByTestId("section-milk")).toBeInTheDocument();
    expect(screen.queryByTestId("section-finance")).not.toBeInTheDocument();
    expect(screen.queryByText("Cash")).not.toBeInTheDocument();
  });

  it("shows finance when the catalogue includes it", () => {
    templatesState.data = catalogue([milk, finance]);
    renderWizard();
    expect(screen.getByTestId("section-finance")).toBeInTheDocument();
  });

  it("requires at least one figure", async () => {
    renderWizard();
    await userEvent.click(screen.getByRole("checkbox", { name: "Include Milk" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Include Health" }));
    await next();
    expect(await screen.findByText("Select at least one figure.", { selector: "p[role=alert]" })).toBeInTheDocument();
    expect(screen.getByText("What to include")).toBeInTheDocument();
  });

  it("keeps choices when going back", async () => {
    renderWizard();
    const card = await openFigures("milk");
    await userEvent.click(within(card).getByRole("checkbox", { name: /Mean yield per recorded cow-day/ }));
    await next();
    expect(await screen.findByText("Pick the days the report covers.")).toBeInTheDocument();
    await back();
    const again = await openFigures("milk");
    expect(within(again).getByRole("checkbox", { name: /Mean yield per recorded cow-day/ })).not.toBeChecked();
    expect(within(again).getByRole("checkbox", { name: /Milk collected/ })).toBeChecked();
  });
});

describe("period and scope validation", () => {
  async function toPeriod() {
    renderWizard();
    await next();
    await screen.findByText("Pick the days the report covers.");
  }

  it("rejects a custom range over 366 days", async () => {
    await toPeriod();
    await userEvent.click(screen.getByRole("radio", { name: "Custom range" }));
    await userEvent.click(screen.getByRole("button", { name: "pick-long-range" }));
    await next();
    expect((await screen.findAllByText("A custom range can be at most 366 days.", { selector: "p[role=alert]" })).length).toBeGreaterThan(0);
  });

  it("rejects custom without dates", async () => {
    await toPeriod();
    await userEvent.click(screen.getByRole("radio", { name: "Custom range" }));
    await next();
    expect(await screen.findByText("Choose both a start and an end date.", { selector: "p[role=alert]" })).toBeInTheDocument();
  });

  it("requires a group id for the group scope", async () => {
    await toPeriod();
    await next();
    await screen.findByText("Choose which animals the report is about.");
    await userEvent.click(screen.getByRole("radio", { name: /A group/ }));
    await next();
    expect(await screen.findByText("Choose a group.", { selector: "p[role=alert]" })).toBeInTheDocument();
  });

  it("requires an animal for the single-animal scope", async () => {
    await toPeriod();
    await next();
    await userEvent.click(await screen.findByRole("radio", { name: /One animal/ }));
    await next();
    expect(await screen.findByText("Choose an animal.", { selector: "p[role=alert]" })).toBeInTheDocument();
  });
});

describe("generate", () => {
  async function toReview(setup?: () => Promise<void>) {
    renderWizard();
    await next();
    await screen.findByText("Pick the days the report covers.");
    await next();
    await screen.findByText("Choose which animals the report is about.");
    if (setup) await setup();
    await next();
    await screen.findByText("Check your choices. Preview is optional and nothing is saved.");
  }
  const generate = () => userEvent.click(screen.getByRole("button", { name: "Generate report" }));

  it("builds an ALL_ELIGIBLE request and opens the new report", async () => {
    createMutate.mockResolvedValue({ kind: "created", report: summary("r1"), replayed: false });
    await toReview();
    await generate();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/reports/r1"));
    const req = createMutate.mock.calls[0][0];
    expect(req).toMatchObject({
      templateId: "on-demand",
      period: { preset: "this_month" },
      scope: { kind: "ALL_ELIGIBLE" },
      selectedMetricIds: ["milk.total_yield", "milk.avg_daily_yield", "health.new_cases"],
    });
    expect(req.forceNew).toBeUndefined();
  });

  it("builds a GROUP request", async () => {
    createMutate.mockResolvedValue({ kind: "created", report: summary("r2"), replayed: false });
    await toReview(async () => {
      await userEvent.click(screen.getByRole("radio", { name: /A group/ }));
      await userEvent.click(await screen.findByRole("button", { name: /Dry cows/ }));
    });
    await generate();
    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate.mock.calls[0][0].scope).toEqual({ kind: "GROUP", groupId: "g1" });
  });

  it("builds a SINGLE_COW request", async () => {
    createMutate.mockResolvedValue({ kind: "created", report: summary("r3"), replayed: false });
    await toReview(async () => {
      await userEvent.click(screen.getByRole("radio", { name: /One animal/ }));
      await userEvent.click(screen.getByRole("button", { name: "pick-cow" }));
    });
    await generate();
    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate.mock.calls[0][0].scope).toEqual({ kind: "SINGLE_COW", cattleId: "cow-9" });
  });

  it("sends custom dates only for the custom preset", async () => {
    createMutate.mockResolvedValue({ kind: "created", report: summary("r4"), replayed: false });
    renderWizard();
    await next();
    await screen.findByText("Pick the days the report covers.");
    await userEvent.click(screen.getByRole("radio", { name: "Custom range" }));
    await userEvent.click(screen.getByRole("button", { name: "pick-valid-range" }));
    await next();
    await screen.findByText("Choose which animals the report is about.");
    await next();
    await screen.findByText("Check your choices. Preview is optional and nothing is saved.");
    await generate();
    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate.mock.calls[0][0].period).toEqual({ preset: "custom", customStartDate: "2026-01-01", customEndDate: "2026-01-10" });
  });

  it("offers open-existing or a forceNew snapshot on a duplicate", async () => {
    createMutate
      .mockResolvedValueOnce({ kind: "duplicate", existing: summary("old") })
      .mockResolvedValueOnce({ kind: "created", report: summary("new"), replayed: false });
    await toReview();
    await generate();
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("A matching report already exists")).toBeInTheDocument();
    expect(within(dialog).getByText("Ready")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Generate a new snapshot" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/reports/new"));
    expect(createMutate.mock.calls[1][0].forceNew).toBe(true);
  });

  it("opens the existing report from the duplicate dialog", async () => {
    createMutate.mockResolvedValueOnce({ kind: "duplicate", existing: summary("old") });
    await toReview();
    await generate();
    await userEvent.click(await screen.findByRole("button", { name: "Open existing" }));
    expect(push).toHaveBeenCalledWith("/reports/old");
    expect(createMutate).toHaveBeenCalledTimes(1);
  });

  it("maps a backend reason to a message and keeps the form intact", async () => {
    createMutate.mockRejectedValue(
      new ReportApiError(new ApiError("BAD_REQUEST", "x", 429, undefined, { reason: "REPORT_TOO_MANY_IN_FLIGHT" })),
    );
    await toReview();
    await generate();
    const alert = await screen.findByTestId("generate-error");
    expect(alert).toHaveTextContent("Too many reports are being generated right now.");
    expect(screen.getByRole("button", { name: "Generate report" })).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });
});
