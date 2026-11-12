import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import { SafetyWithdrawalSection } from "./safety-withdrawal-tab";

const h = vi.hoisted(() => ({
  filters: [] as unknown[],
  totalPages: 1,
  goToPage: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/auth/permissions", () => ({ Can: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("../hooks/use-health", () => ({
  useSafetyWithdrawalsPagedList: (filters: unknown) => {
    h.filters.push(filters);
    return {
      items: [],
      page: 1,
      totalPages: h.totalPages,
      pageSize: 20,
      setPageSize: vi.fn(),
      goToPage: h.goToPage,
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    };
  },
  useRefreshSafetyWithdrawals: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("./safety-withdrawal-table", () => ({ SafetyWithdrawalTable: () => <div data-testid="table" /> }));
vi.mock("@/components/shared/pagination", () => ({
  Pagination: ({ onPageChange }: { onPageChange: (page: number) => void }) => (
    <button type="button" onClick={() => onPageChange(2)}>
      next-page
    </button>
  ),
}));

function renderSection() {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
      <SafetyWithdrawalSection />
    </NextIntlClientProvider>,
  );
}

describe("SafetyWithdrawalSection — paged (RFE-141)", () => {
  beforeEach(() => {
    h.filters = [];
    h.totalPages = 1;
    h.goToPage = vi.fn();
  });

  it("starts on the animals still withholding (the milk-room question)", () => {
    renderSection();
    expect(h.filters.at(-1)).toEqual({ activeOnly: true });
  });

  it("'All' asks for the history instead — and is paged, not cut at the first 20 rows", () => {
    h.totalPages = 4;
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: en.health.safetyWithdrawals.filter.all }));
    expect(h.filters.at(-1)).toEqual({});
    fireEvent.click(screen.getByRole("button", { name: "next-page" }));
    expect(h.goToPage).toHaveBeenCalledWith(2);
  });

  it("no pager when everything fits on one page", () => {
    renderSection();
    expect(screen.queryByRole("button", { name: "next-page" })).toBeNull();
  });
});
