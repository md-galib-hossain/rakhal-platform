import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ColumnDef } from "@tanstack/react-table";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import { DataTable } from "./data-table";

interface Row {
  id: string;
  name: string;
}

const columns: ColumnDef<Row, unknown>[] = [
  { accessorKey: "name", header: "Name" },
];

describe("DataTable", () => {
  it("renders rows", () => {
    render(<DataTable columns={columns} data={[{ id: "1", name: "Cow #1" }]} getRowId={(r) => r.id} />, {
      wrapper: withNuqsTestingAdapter(),
    });
    expect(screen.getByText("Cow #1")).toBeInTheDocument();
  });

  it("renders the empty state when there is no data and not loading", () => {
    render(
      <DataTable columns={columns} data={[]} emptyState={{ title: "No cattle yet", description: "Add your first animal" }} />,
      { wrapper: withNuqsTestingAdapter() },
    );
    expect(screen.getByText("No cattle yet")).toBeInTheDocument();
    expect(screen.getByText("Add your first animal")).toBeInTheDocument();
  });

  it("renders the error state and wires the retry action", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<DataTable columns={columns} data={[]} isError onRetry={onRetry} />, {
      wrapper: withNuqsTestingAdapter(),
    });
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("shows a Load more button when hasNextPage is true and calls onLoadMore", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
        <DataTable columns={columns} data={[{ id: "1", name: "Cow #1" }]} hasNextPage onLoadMore={onLoadMore} />
      </NextIntlClientProvider>,
      { wrapper: withNuqsTestingAdapter() },
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
      { wrapper: withNuqsTestingAdapter() },
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
      { wrapper: withNuqsTestingAdapter() },
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
      { wrapper: withNuqsTestingAdapter() },
    );
    const row = screen.getByText("Cow #1").closest("tr")!;
    row.focus();
    await user.keyboard("{Enter}");
    expect(onRowClick).toHaveBeenCalledWith({ id: "1", name: "Cow #1" });
  });
});
