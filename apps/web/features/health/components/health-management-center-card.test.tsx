import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import en from "@/i18n/messages/en.json";
import { HealthManagementCenterCard, parseHealthTab } from "./health-management-center-card";

vi.mock("./treatments-tab", () => ({ TreatmentsTab: () => <div data-testid="tab-treatments" /> }));
vi.mock("./health-plan-tab", () => ({ HealthPlanTab: () => <div data-testid="tab-protocols" /> }));
vi.mock("./health-insights-tab", () => ({ HealthInsightsTab: () => <div data-testid="tab-insights" /> }));
vi.mock("./health-filter-bar", () => ({ HealthFilterBar: () => <div data-testid="health-filter-bar" /> }));
vi.mock("@/components/shared/filter-bar", () => ({ FilterBar: () => <div data-testid="filter-bar" /> }));

function renderCard(search = "") {
  const Adapter = withNuqsTestingAdapter({ searchParams: search });
  render(
    <Adapter>
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
        <HealthManagementCenterCard onManageCase={vi.fn()} onReportSickness={vi.fn()} onRecordTreatment={vi.fn()} />
      </NextIntlClientProvider>
    </Adapter>,
  );
}

describe("HealthManagementCenterCard (RFE-140, RFE-143)", () => {
  it("has three plainly named tabs — the Schedule / Care steps tab is gone", () => {
    renderCard();
    for (const name of ["Sick Bay", "Protocols", "Insights"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: "Schedule" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Care steps" })).toBeNull();
  });

  it("opens on the Sick Bay, and does not mount the Insights charts until asked", () => {
    renderCard();
    expect(screen.getByTestId("tab-treatments")).toBeTruthy();
    expect(screen.queryByTestId("tab-insights")).toBeNull();
  });

  it("?healthTab=insights opens Insights only", () => {
    renderCard("?healthTab=insights");
    expect(screen.getByTestId("tab-insights")).toBeTruthy();
    expect(screen.queryByTestId("tab-treatments")).toBeNull();
  });

  it("an old reminder link (?healthTab=schedule) opens Protocols, where the due steps are recorded now", () => {
    renderCard("?healthTab=schedule&bucket=overdue");
    expect(screen.getByTestId("tab-protocols")).toBeTruthy();
    expect(screen.queryByTestId("tab-treatments")).toBeNull();
  });

  it("?healthTab=treatments still opens Sick Bay", () => {
    renderCard("?healthTab=treatments");
    expect(screen.getByTestId("tab-treatments")).toBeTruthy();
  });

  it("the attention strip is gone", () => {
    renderCard();
    expect(screen.queryByText("Needs attention")).toBeNull();
    expect(screen.queryByText("Overdue steps")).toBeNull();
    expect(screen.queryByText(/Withdrawals ending/)).toBeNull();
  });

  it("the report / record buttons sit on the Sick Bay tab only", () => {
    renderCard("?healthTab=protocols");
    expect(screen.queryByRole("button", { name: "Report Sickness" })).toBeNull();
  });
});

describe("parseHealthTab", () => {
  it("maps the retired schedule tab to protocols and rejects unknown values", () => {
    expect(parseHealthTab("schedule")).toBe("protocols");
    expect(parseHealthTab("protocols")).toBe("protocols");
    expect(parseHealthTab("treatments")).toBe("treatments");
    expect(parseHealthTab("insights")).toBe("insights");
    expect(parseHealthTab("nonsense")).toBeNull();
  });
});
