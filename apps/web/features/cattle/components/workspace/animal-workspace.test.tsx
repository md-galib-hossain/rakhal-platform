import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import { ApiError } from "@/lib/api/errors";
import type { CattleDetail } from "../../types";
import { AnimalWorkspace } from "./animal-workspace";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const refetch = vi.fn();
let state: { data?: CattleDetail; isLoading: boolean; isError: boolean; isFetching: boolean; error: unknown };

vi.mock("nuqs", () => ({ parseAsString: {}, useQueryState: () => [null, vi.fn()] }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/auth/permissions", () => ({ useCan: () => () => true }));
vi.mock("../../hooks/use-cattle", () => ({
  useCattleDetail: () => ({ ...state, refetch }),
  useRestoreCattle: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("./workspace-header", () => ({ WorkspaceHeader: () => <h2>animal header</h2> }));
vi.mock("./workspace-sections", () => ({
  SectionSwitcher: () => <div>switcher</div>,
  SectionBody: () => <div>section body</div>,
}));
vi.mock("@/features/events/components/event-picker/event-picker", () => ({ EventPicker: () => null }));
vi.mock("@/features/events/components/event-picker/event-form-placeholder", () => ({ EventFormPlaceholder: () => null }));
vi.mock("@/features/events/components/form/event-form-panel", () => ({ EventFormPanel: () => null }));

const cow = { id: "c1", tagNumber: "T-1", herdStatus: "ACTIVE", deletedAt: null } as unknown as CattleDetail;
const onOpenChange = vi.fn();

function renderWorkspace() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AnimalWorkspace cattleId="c1" onOpenChange={onOpenChange} onDispose={vi.fn()} onDelete={vi.fn()} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  state = { isLoading: false, isError: false, isFetching: false, error: null };
});

describe("AnimalWorkspace load failures (RFE-170)", () => {
  it("keeps the loaded animal and shows a Retry banner when a background refetch fails", () => {
    state = { ...state, data: cow, isError: true, error: new ApiError("INTERNAL_ERROR", "boom", 500) };
    renderWorkspace();
    expect(screen.getByText("animal header")).toBeInTheDocument();
    expect(screen.getByText("section body")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Couldn't refresh, showing saved data");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows no banner while the data is healthy", () => {
    state = { ...state, data: cow };
    renderWorkspace();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the full error with Retry and Close when nothing ever loaded", () => {
    state = { ...state, isError: true, error: new ApiError("INTERNAL_ERROR", "boom", 500) };
    renderWorkspace();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load this animal.");
    expect(screen.queryByText("section body")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("gives a 404 its own not-found state with Back and no Retry", () => {
    state = { ...state, isError: true, error: new ApiError("NOT_FOUND", "gone", 404) };
    renderWorkspace();
    expect(screen.getByRole("alert")).toHaveTextContent("Animal not found");
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
