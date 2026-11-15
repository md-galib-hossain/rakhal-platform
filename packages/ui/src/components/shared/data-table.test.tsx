import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ColumnDef } from "@tanstack/react-table";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { useQueryState as useNuqsQueryState, parseAsString } from "nuqs";
import { QueryStateProvider, type QueryStateApi } from "../../lib/query-state";
import { LabelsProvider } from "../../lib/labels";
import { DataTable } from "./data-table";

interface Row {
  id: string;
  name: string;
}

const columns: ColumnDef<Row, unknown>[] = [
  { accessorKey: "name", header: "Name" },
];

// DataTable only ever calls useQueryState; the other two aren't exercised here.
const queryStateApi: QueryStateApi = {
  useQueryState: (key, defaultValue) =>
    useNuqsQueryState(key, defaultValue !== undefined ? parseAsString.withDefault(defaultValue) : parseAsString),
  useSearchParamsSnapshot: () => new URLSearchParams(),
  useClearQueryParams: () => () => {},
};

const labels = {
  datePicker: { today: "Today", clear: "Clear" },
  dateTimePicker: { time: "Time", hour: "Hour", minute: "Minute", now: "Now", clear: "Clear", done: "Done" },
  infiniteScroll: {
    loading: "Loading more…",
    error: "Could not load more. Your list is safe.",
    retry: "Retry",
    loadMore: "Load more",
    end: "All {count} loaded",
  },
};

const NuqsWrapper = withNuqsTestingAdapter();
function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NuqsWrapper>
      <QueryStateProvider api={queryStateApi}>
        <LabelsProvider labels={labels}>{children}</LabelsProvider>
      </QueryStateProvider>
    </NuqsWrapper>
  );
}

describe("DataTable", () => {
  it("renders rows", () => {
    render(<DataTable columns={columns} data={[{ id: "1", name: "Cow #1" }]} getRowId={(r) => r.id} />, { wrapper });
    expect(screen.getByText("Cow #1")).toBeInTheDocument();
  });

  it("renders the empty state when there is no data and not loading", () => {
    render(
      <DataTable columns={columns} data={[]} emptyState={{ title: "No cattle yet", description: "Add your first animal" }} />,
      { wrapper },
    );
    expect(screen.getByText("No cattle yet")).toBeInTheDocument();
    expect(screen.getByText("Add your first animal")).toBeInTheDocument();
  });

  it("renders the error state and wires the retry action", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<DataTable columns={columns} data={[]} isError onRetry={onRetry} />, { wrapper });
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("shows a Load more button when hasNextPage is true and calls onLoadMore", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    render(
      <DataTable columns={columns} data={[{ id: "1", name: "Cow #1" }]} hasNextPage onLoadMore={onLoadMore} />,
      { wrapper },
    );
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(onLoadMore).toHaveBeenCalled();
  });

  it("supports row selection", async () => {
    const user = userEvent.setup();
    const onRowSelectionChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={[{ id: "1", name: "Cow #1" }]}
        getRowId={(r) => r.id}
        enableRowSelection
        rowSelection={{}}
        onRowSelectionChange={onRowSelectionChange}
      />,
      { wrapper },
    );
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);
    expect(onRowSelectionChange).toHaveBeenCalled();
  });

  it("calls onRowClick when a row is clicked, but not when selecting checkbox", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const onRowSelectionChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={[{ id: "1", name: "Cow #1" }]}
        getRowId={(r) => r.id}
        enableRowSelection
        rowSelection={{}}
        onRowSelectionChange={onRowSelectionChange}
        onRowClick={onRowClick}
      />,
      { wrapper },
    );
    // Click checkbox: should trigger onRowSelectionChange, not onRowClick
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);
    expect(onRowSelectionChange).toHaveBeenCalled();
    expect(onRowClick).not.toHaveBeenCalled();

    // Click row cell content: should trigger onRowClick
    await user.click(screen.getByText("Cow #1"));
    expect(onRowClick).toHaveBeenCalledWith({ id: "1", name: "Cow #1" });
  });

  it("calls onRowClick on Enter keydown on the row", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={[{ id: "1", name: "Cow #1" }]}
        getRowId={(r) => r.id}
        onRowClick={onRowClick}
      />,
      { wrapper },
    );
    const row = screen.getByText("Cow #1").closest("tr")!;
    row.focus();
    await user.keyboard("{Enter}");
    expect(onRowClick).toHaveBeenCalledWith({ id: "1", name: "Cow #1" });
  });
});
