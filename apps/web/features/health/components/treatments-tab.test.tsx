import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import en from "@/i18n/messages/en.json";
import { TreatmentsTab } from "./treatments-tab";

const h = vi.hoisted(() => ({
  sickBayPage: { items: [] as unknown[], totalPages: 1, goToPage: vi.fn() },
}));

const pager = (p: { items: unknown[]; totalPages: number; goToPage: () => void }) => ({
  ...p,
  page: 1,
  pageSize: 20,
  setPageSize: vi.fn(),
  isLoading: false,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
});

vi.mock("../hooks/use-health", () => ({
  useHealthDashboard: () => ({ data: { sickBayCount: 3, safetyWithdrawalCount: 2 } }),
  useSickBayPagedList: () => pager(h.sickBayPage),
}));
vi.mock("./sick-bay-table", () => ({ SickBayTable: () => <div data-testid="sick-bay-table" /> }));
vi.mock("./safety-withdrawal-tab", () => ({ SafetyWithdrawalSection: () => <div data-testid="withdrawals" /> }));
vi.mock("./treatment-history-table", () => ({ TreatmentHistorySection: () => <div data-testid="treatment-history" /> }));
vi.mock("@/components/shared/pagination", () => ({
  Pagination: ({ onPageChange }: { onPageChange: (page: number) => void }) => (
    <button type="button" onClick={() => onPageChange(2)}>
      next-page
    </button>
  ),
}));

function renderTab(view?: string) {
  const Adapter = withNuqsTestingAdapter({ searchParams: view ? `?bay=${view}` : "" });
  render(
    <Adapter>
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
        <TreatmentsTab search="" onManageCase={vi.fn()} />
      </NextIntlClientProvider>
    </Adapter>,
  );
}

describe("TreatmentsTab — one paged list at a time (RFE-141)", () => {
  beforeEach(() => {
    h.sickBayPage = { items: [], totalPages: 1, goToPage: vi.fn() };
  });

  it("opens on the animals under treatment, not on every table stacked", () => {
    renderTab();
    expect(screen.getByTestId("sick-bay-table")).toBeTruthy();
    expect(screen.queryByTestId("withdrawals")).toBeNull();
    expect(screen.queryByText("Preventive Rounds")).toBeNull();
  });

  it("has three views: cases, history, and withheld", () => {
    renderTab();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: /Treatment History/i })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /Preventive rounds/i })).toBeNull();
  });

  it("an old ?bay=rounds link falls back to the Sick Bay list instead of a blank tab", () => {
    renderTab("rounds");
    expect(screen.getByTestId("sick-bay-table")).toBeTruthy();
  });

  it("the pill counts are the server's counts, not the size of the page on screen", () => {
    renderTab();
    expect(screen.getByRole("tab", { name: /Under treatment/ }).textContent).toContain("3");
    expect(screen.getByRole("tab", { name: /Milk\/meat withheld/ }).textContent).toContain("2");
  });

  it("switching to Withheld swaps the list; a closed case's withdrawal is still reachable", () => {
    renderTab();
    fireEvent.click(screen.getByRole("tab", { name: /Milk\/meat withheld/ }));
    expect(screen.getByTestId("withdrawals")).toBeTruthy();
    expect(screen.queryByTestId("sick-bay-table")).toBeNull();
  });

  it("switching to History swaps to the treatment history list", () => {
    renderTab();
    fireEvent.click(screen.getByRole("tab", { name: /Treatment History/ }));
    expect(screen.getByTestId("treatment-history")).toBeTruthy();
    expect(screen.queryByTestId("sick-bay-table")).toBeNull();
  });

  it("a ?bay=history link opens treatment history directly", () => {
    renderTab("history");
    expect(screen.getByTestId("treatment-history")).toBeTruthy();
  });

  it("a ?bay=withheld link (from the stat strip) opens that list directly", () => {
    renderTab("withheld");
    expect(screen.getByTestId("withdrawals")).toBeTruthy();
  });

  it("the Sick Bay list pages once there is more than one page", () => {
    h.sickBayPage = { items: [], totalPages: 3, goToPage: vi.fn() };
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "next-page" }));
    expect(h.sickBayPage.goToPage).toHaveBeenCalledWith(2);
  });

  it("no pager for a single page", () => {
    renderTab();
    expect(screen.queryByRole("button", { name: "next-page" })).toBeNull();
  });
});
