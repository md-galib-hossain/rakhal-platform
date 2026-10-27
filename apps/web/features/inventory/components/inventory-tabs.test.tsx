import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import en from "@/i18n/messages/en.json";
import { InventoryTabs } from "./inventory-tabs";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function renderTabs(
  props: {
    view?: "table" | "grid";
    onViewChange?: (v: "table" | "grid") => void;
    showViewToggle?: boolean;
  } = {},
  searchParams?: Record<string, string>,
) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <InventoryTabs
        view={props.view ?? "table"}
        onViewChange={props.onViewChange ?? vi.fn()}
        showViewToggle={props.showViewToggle}
      />
    </NextIntlClientProvider>,
    {
      wrapper: withNuqsTestingAdapter({
        searchParams: searchParams ?? {},
      }),
    },
  );
}

describe("InventoryTabs", () => {
  it("renders view toggle on tabs that support both views (e.g. medicine default)", () => {
    renderTabs({}, { tab: "medicine" });
    expect(screen.getByRole("button", { name: en.inventory.tabs.gridView })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.inventory.tabs.tableView })).toBeInTheDocument();
  });

  it("renders view toggle on feed and equipment tabs", () => {
    const { unmount } = renderTabs({}, { tab: "feed" });
    expect(screen.getByRole("button", { name: en.inventory.tabs.gridView })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.inventory.tabs.tableView })).toBeInTheDocument();
    unmount();

    renderTabs({}, { tab: "others" });
    expect(screen.getByRole("button", { name: en.inventory.tabs.gridView })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.inventory.tabs.tableView })).toBeInTheDocument();
  });

  it("does NOT render view toggle on semen tab", () => {
    renderTabs({}, { tab: "semen" });
    expect(screen.queryByRole("button", { name: en.inventory.tabs.gridView })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.inventory.tabs.tableView })).not.toBeInTheDocument();
  });

  it("does NOT render view toggle on milk tab", () => {
    renderTabs({}, { tab: "milk" });
    expect(screen.queryByRole("button", { name: en.inventory.tabs.gridView })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.inventory.tabs.tableView })).not.toBeInTheDocument();
  });

  it("allows overriding showViewToggle via prop", () => {
    renderTabs({ showViewToggle: false }, { tab: "medicine" });
    expect(screen.queryByRole("button", { name: en.inventory.tabs.gridView })).not.toBeInTheDocument();
  });
});
