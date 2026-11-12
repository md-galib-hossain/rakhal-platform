import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import en from "@/i18n/messages/en.json";
import { makeReport } from "./report-fixture";
import { ReportsHistory } from "./reports-history";

const h = vi.hoisted(() => ({
  calls: [] as unknown[],
  state: { items: [] as unknown[], isLoading: false, isError: false },
  refetch: vi.fn(),
}));

vi.mock("@/features/reports", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/reports")>();
  const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return {
    ...actual,
    useDownloadReport: mutation,
    useRetryReport: mutation,
    useDeleteReport: mutation,
    useReportsInfinite: (filters: unknown) => {
      h.calls.push(filters);
      return {
        ...h.state,
        meta: undefined,
        isFetching: false,
        refetch: h.refetch,
        hasNextPage: false,
        isFetchingNextPage: false,
        isNextPageError: false,
        fetchNextPage: vi.fn(),
      };
    },
  };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderHistory(search = "") {
  const Adapter = withNuqsTestingAdapter({ searchParams: search });
  render(
    <Adapter>
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
        <ReportsHistory canRetry canDelete canStartNew />
      </NextIntlClientProvider>
    </Adapter>,
  );
}

describe("ReportsHistory", () => {
  beforeEach(() => {
    h.calls = [];
    h.state = { items: [], isLoading: false, isError: false };
    h.refetch.mockReset();
  });

  it("URL filters become the list query", () => {
    renderHistory("?type=WEEKLY&origin=SCHEDULED&status=FAILED");
    expect(h.calls.at(-1)).toEqual({ type: "WEEKLY", origin: "SCHEDULED", status: "FAILED" });
  });

  it("ignores unknown filter values instead of sending them", () => {
    renderHistory("?type=BOGUS&status=FAILED");
    expect(h.calls.at(-1)).toEqual({ type: undefined, origin: undefined, status: "FAILED" });
  });

  it("no filters: the query has none", () => {
    renderHistory();
    expect(h.calls.at(-1)).toEqual({ type: undefined, origin: undefined, status: undefined });
  });

  it("empty with no filters: 'No reports yet' with a New report CTA", () => {
    renderHistory();
    expect(screen.getByText("No reports yet")).toBeTruthy();
    expect(screen.getByRole("link", { name: "New report" }).getAttribute("href")).toBe("/reports/new");
  });

  it("empty because of filters: says nothing matches and offers Clear filters", () => {
    renderHistory("?status=FAILED");
    expect(screen.getByText("No reports match")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Clear filters" }).length).toBeGreaterThan(0);
  });

  it("error: message and Try again that refetches", () => {
    h.state.isError = true;
    renderHistory();
    expect(screen.getByText("Could not load reports")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(h.refetch).toHaveBeenCalled();
  });

  it("loading: busy skeleton", () => {
    h.state.isLoading = true;
    renderHistory();
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it("success: renders the rows", () => {
    h.state.items = [makeReport({ id: "a" }), makeReport({ id: "b", type: "MONTHLY" })];
    renderHistory();
    expect(screen.getAllByText("Monthly").length).toBeGreaterThan(0);
  });
});
