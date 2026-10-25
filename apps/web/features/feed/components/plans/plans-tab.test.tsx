import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import en from "@/i18n/messages/en.json";
import bn from "@/i18n/messages/bn.json";
import { PlansTab } from "./plans-tab";
import type { FeedPlan } from "../../plans-types";

interface MockAnimalGroup {
  id: string;
  name: string;
  memberCount: number;
  description?: string | null;
}

const { mockArchiveMutation, getPlansData, setPlansData, getGroupsData, setGroupsData } = vi.hoisted(() => {
  let plans: FeedPlan[] = [];
  let groups: MockAnimalGroup[] = [];
  return {
    mockArchiveMutation: vi.fn().mockResolvedValue({ success: true }),
    getPlansData: () => plans,
    setPlansData: (p: FeedPlan[]) => {
      plans = p;
    },
    getGroupsData: () => groups,
    setGroupsData: (g: MockAnimalGroup[]) => {
      groups = g;
    },
  };
});

const mockPlans: FeedPlan[] = [
  {
    id: "plan-1",
    name: "High Yield Lactating TMR",
    kind: "PLAN",
    notes: null,
    made_for_cattle_id: null,
    made_for_animal_group_id: null,
    reference_requirement: null,
    is_active: true,
    applied_to: { cattle_ids: ["cow-1", "cow-2"], group_ids: [], herd: false },
    lines: [
      {
        id: "l1",
        line_type: "FEED_ITEM",
        feed_item_id: "fi-1",
        concentration_id: null,
        name: "Corn Silage",
        recipe_kind: null,
        kg_per_day: 25,
        sort_order: 1,
      },
    ],
    total_kg_per_day: 41,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  },
  {
    id: "plan-2",
    name: "Dry Cow Maintenance",
    kind: "PLAN",
    notes: null,
    made_for_cattle_id: null,
    made_for_animal_group_id: null,
    reference_requirement: null,
    is_active: true,
    applied_to: { cattle_ids: [], group_ids: [], herd: false },
    lines: [],
    total_kg_per_day: 22,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  },
];

vi.mock("@/lib/auth/permissions", () => ({
  Can: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useCan: () => () => true,
}));

vi.mock("../../hooks/use-feed-plans", () => ({
  useFeedPlansList: () => ({
    items: getPlansData(),
    isLoading: false,
    isError: false,
    page: 1,
    totalPages: 1,
    pageSize: 20,
    goToPage: vi.fn(),
    setPageSize: vi.fn(),
    refetch: vi.fn(),
  }),
  useArchiveFeedPlan: () => ({
    mutateAsync: mockArchiveMutation,
    isPending: false,
  }),
  useFeedPlanAssignments: () => ({
    data: { items: [] },
    isLoading: false,
  }),
  useRemoveFeedAssignment: () => ({
    mutateAsync: vi.fn(),
  }),
}));

vi.mock("@/features/cattle/hooks/use-cattle", () => ({
  useAnimalGroups: () => ({
    data: { items: getGroupsData() },
  }),
}));

function renderWithProviders(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={en}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("PlansTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setPlansData(mockPlans);
    setGroupsData([]);
  });

  it("renders header metrics, filter tabs and plan cards", () => {
    renderWithProviders(<PlansTab />);

    // Title
    expect(screen.getByText("Feed Plans")).toBeInTheDocument();

    // Metric chips
    expect(screen.getByText("2 Plans")).toBeInTheDocument();
    expect(screen.getByText("1 Active Program")).toBeInTheDocument();
    expect(screen.getByText("2 Cows Covered")).toBeInTheDocument();

    // Filter tabs
    expect(screen.getByRole("button", { name: /All Plans \(2\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Active \/ Applied \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Unassigned Drafts \(1\)/i })).toBeInTheDocument();

    // Cards
    expect(screen.getByText("High Yield Lactating TMR")).toBeInTheDocument();
    expect(screen.getByText("Dry Cow Maintenance")).toBeInTheDocument();
  });

  it("calculates accurate group cattle headcounts from useAnimalGroups without arbitrary multipliers", () => {
    setGroupsData([{ id: "grp-1", name: "Milkers Shed A", memberCount: 7 }]);
    setPlansData([
      {
        ...mockPlans[0],
        applied_to: { cattle_ids: ["cow-1"], group_ids: ["grp-1"], herd: false },
        total_kg_per_day: 10,
      },
    ]);

    renderWithProviders(<PlansTab />);

    // 1 direct cow + 7 group members = 8 cows covered
    expect(screen.getByText("8 Cows Covered")).toBeInTheDocument();
    // Plan card badge
    expect(screen.getByText("Active • 8 Cows")).toBeInTheDocument();
    // Demand widget calculation: 8 cows × 10.0 kg/day = 80.0 kg/day
    expect(screen.getByText("8 cows × 10.0 kg/day")).toBeInTheDocument();
    expect(screen.getByText("80.0 kg/day")).toBeInTheDocument();
    // Button
    expect(screen.getByRole("button", { name: /View & Manage 8 Cows →/i })).toBeInTheDocument();
  });

  it("displays Whole Herd Default badge, per-head demand, and View & Manage Herd button when applied to herd without individual cattle", () => {
    setPlansData([
      {
        ...mockPlans[0],
        applied_to: { cattle_ids: [], group_ids: [], herd: true },
        total_kg_per_day: 15,
      },
    ]);

    renderWithProviders(<PlansTab />);

    // Card status badge
    expect(screen.getAllByText("Active • Whole Herd Default").length).toBeGreaterThanOrEqual(1);
    // Herd Demand widget: per-head rate without multiplying by fake 1
    expect(screen.getByText("15.0 kg/head/day · Whole Herd")).toBeInTheDocument();
    expect(screen.getByText("15.0 kg/head")).toBeInTheDocument();
    // Button
    expect(screen.getByRole("button", { name: /View & Manage Herd →/i })).toBeInTheDocument();
  });

  it("renders contextual empty state with Switch to All Plans button when a filter has 0 matching plans", () => {
    // Both plans are applied
    setPlansData([
      { ...mockPlans[0], applied_to: { cattle_ids: ["cow-1"], group_ids: [], herd: false } },
      { ...mockPlans[1], applied_to: { cattle_ids: ["cow-2"], group_ids: [], herd: false } },
    ]);

    renderWithProviders(<PlansTab />);

    // Click Unassigned filter which now has 0 plans
    const unassignedBtn = screen.getByRole("button", { name: /Unassigned Drafts \(0\)/i });
    fireEvent.click(unassignedBtn);

    expect(screen.getByText("No plans in this filter")).toBeInTheDocument();
    expect(screen.getByText("No feed plans match the selected status filter.")).toBeInTheDocument();

    const switchBtn = screen.getByRole("button", { name: /Switch to All Plans/i });
    expect(switchBtn).toBeInTheDocument();

    fireEvent.click(switchBtn);

    // Both plans reappear
    expect(screen.getByText("High Yield Lactating TMR")).toBeInTheDocument();
    expect(screen.getByText("Dry Cow Maintenance")).toBeInTheDocument();
  });

  it("filters cards when filter tabs are clicked", () => {
    renderWithProviders(<PlansTab />);

    const activeFilterBtn = screen.getByRole("button", { name: /Active \/ Applied \(1\)/i });
    fireEvent.click(activeFilterBtn);

    expect(screen.getByText("High Yield Lactating TMR")).toBeInTheDocument();
    expect(screen.queryByText("Dry Cow Maintenance")).not.toBeInTheDocument();

    const unassignedFilterBtn = screen.getByRole("button", { name: /Unassigned Drafts \(1\)/i });
    fireEvent.click(unassignedFilterBtn);

    expect(screen.queryByText("High Yield Lactating TMR")).not.toBeInTheDocument();
    expect(screen.getByText("Dry Cow Maintenance")).toBeInTheDocument();
  });

  it("opens AssignedCattleDialog when View & Manage Cows is clicked", () => {
    renderWithProviders(<PlansTab />);

    const viewBtn = screen.getByRole("button", { name: /View & Manage 2 Cows →/i });
    expect(viewBtn).toBeInTheDocument();
    fireEvent.click(viewBtn);

    expect(screen.getByText("Assigned Cattle — High Yield Lactating TMR")).toBeInTheDocument();
  });

  it("displays unassigned draft badge and clean notice without NaN for plan with 0 assignments", () => {
    renderWithProviders(<PlansTab />);

    expect(screen.getByText("Unassigned Draft")).toBeInTheDocument();
    expect(
      screen.getByText("Unassigned · Apply to calculate daily herd volume"),
    ).toBeInTheDocument();
    expect(screen.getByText("No animals assigned yet")).toBeInTheDocument();
    expect(screen.queryByText(/\bNaN\b/)).not.toBeInTheDocument();
  });

  it("supports clearing search input with clear X button", () => {
    renderWithProviders(<PlansTab />);

    const searchInput = screen.getByPlaceholderText("Search plans");
    fireEvent.change(searchInput, { target: { value: "Lactating" } });

    const clearBtn = screen.getByRole("button", { name: /Clear search/i });
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);
    expect(searchInput).toHaveValue("");
    expect(screen.queryByRole("button", { name: /Clear search/i })).not.toBeInTheDocument();
  });

  it("handles standard delete on unassigned plan via confirmation dialog", async () => {
    renderWithProviders(<PlansTab />);

    const moreBtn = screen.getByRole("button", {
      name: "More actions for Dry Cow Maintenance",
    });
    fireEvent.pointerDown(moreBtn);

    const deleteMenuItem = await screen.findByText("Delete");
    fireEvent.click(deleteMenuItem);

    expect(screen.getByText("Delete this plan?")).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockArchiveMutation).toHaveBeenCalledWith({
        id: "plan-2",
        removeAssignments: false,
      });
    });
  });

  it("handles force-delete on applied plan via unassign & delete dialog", async () => {
    renderWithProviders(<PlansTab />);

    const moreBtn = screen.getByRole("button", {
      name: "More actions for High Yield Lactating TMR",
    });
    fireEvent.pointerDown(moreBtn);

    const deleteMenuItem = await screen.findByText("Delete");
    fireEvent.click(deleteMenuItem);

    expect(screen.getByText("Remove from all and delete?")).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Remove from all & delete" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockArchiveMutation).toHaveBeenCalledWith({
        id: "plan-1",
        removeAssignments: true,
      });
    });
  });

  it("renders correctly in Bengali locale (bn)", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale="bn" messages={bn}>
          <PlansTab />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );

    // Title in Bengali
    expect(screen.getByText("ফিড প্ল্যান")).toBeInTheDocument();
    // Unassigned badge in Bengali
    expect(screen.getByText("অনির্ধারিত ড্রাফট")).toBeInTheDocument();
  });
});

