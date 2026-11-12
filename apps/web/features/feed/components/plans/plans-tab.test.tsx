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

  it("renders uncluttered header and plan cards without KPI chips or filter tabs", () => {
    renderWithProviders(<PlansTab />);

    // Title & subtitle
    expect(screen.getByText("Feed Plans")).toBeInTheDocument();
    expect(
      screen.getByText("What one animal eats per day. A plan changes nothing until you apply it."),
    ).toBeInTheDocument();

    // Search and Create CTA
    expect(screen.getByPlaceholderText("Search plans")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New plan/i })).toBeInTheDocument();

    // Verify removed KPI chips and filter tabs are NOT rendered
    expect(screen.queryByText(/Plans/i)).not.toHaveTextContent("2 Plans");
    expect(screen.queryByText(/Active Program/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cows Covered/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /All Plans/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Active \/ Applied/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Unassigned Drafts/i })).not.toBeInTheDocument();

    // Cards
    expect(screen.getByText("High Yield Lactating TMR")).toBeInTheDocument();
    expect(screen.getByText("Dry Cow Maintenance")).toBeInTheDocument();
  });

  it("calculates accurate group cattle headcounts from useAnimalGroups in bottom card info", () => {
    setGroupsData([{ id: "grp-1", name: "Milkers Shed A", memberCount: 7 }]);
    setPlansData([
      {
        ...mockPlans[0],
        applied_to: { cattle_ids: ["cow-1"], group_ids: ["grp-1"], herd: false },
        total_kg_per_day: 10,
      },
    ]);

    renderWithProviders(<PlansTab />);

    // 1 direct cow + 7 group members = 8 cows assigned
    expect(screen.getByText("8 cows")).toBeInTheDocument();
    // Demand calculation: 8 cows × 10.0 kg/day = 80.0 kg/day total
    expect(screen.getByText("80.0 kg/day total")).toBeInTheDocument();
    // Button
    expect(screen.getByRole("button", { name: /View Assigned Animals/i })).toBeInTheDocument();
  });

  it("displays Whole Herd info, per-head demand subtext, and View Assigned Animals button when applied to herd without individual cattle", () => {
    setPlansData([
      {
        ...mockPlans[0],
        applied_to: { cattle_ids: [], group_ids: [], herd: true },
        total_kg_per_day: 15,
      },
    ]);

    renderWithProviders(<PlansTab />);

    // Card herd label and per-head subtext
    expect(screen.getByText("Whole herd")).toBeInTheDocument();
    expect(screen.getByText("15.0 kg/head")).toBeInTheDocument();
    // Button
    expect(screen.getByRole("button", { name: /View Assigned Animals/i })).toBeInTheDocument();
  });

  it("opens AssignedCattleDialog when View Assigned Animals is clicked", () => {
    renderWithProviders(<PlansTab />);

    const viewBtn = screen.getByRole("button", { name: /View Assigned Animals/i });
    expect(viewBtn).toBeInTheDocument();
    fireEvent.click(viewBtn);

    expect(screen.getByText("Assigned Cattle — High Yield Lactating TMR")).toBeInTheDocument();
  });

  it("displays unassigned badge and clean notice for plan with 0 assignments", () => {
    renderWithProviders(<PlansTab />);

    expect(screen.getByText("Not applied yet")).toBeInTheDocument();
    expect(
      screen.getByText("Unassigned · Apply to calculate daily herd volume"),
    ).toBeInTheDocument();
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
    // Not applied badge in Bengali
    expect(screen.getByText("এখনও প্রয়োগ করা হয়নি")).toBeInTheDocument();
  });
});

