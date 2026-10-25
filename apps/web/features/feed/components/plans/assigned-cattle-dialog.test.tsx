import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import en from "@/i18n/messages/en.json";
import { AssignedCattleDialog } from "./assigned-cattle-dialog";
import type { FeedPlan } from "../../plans-types";

const { mockRemoveMutation, getMockAssignments } = vi.hoisted(() => {
  const defaultItems = [
    {
      id: "as-1",
      plan_id: "plan-1",
      target_type: "INDIVIDUAL",
      cattle_id: "cow-1",
      animal_group_id: null,
      applied_at: "2026-01-01",
      applied_by: "user-1",
      removed_at: null,
      removed_by: null,
    },
    {
      id: "as-2",
      plan_id: "plan-1",
      target_type: "GROUP",
      cattle_id: null,
      animal_group_id: "grp-1",
      applied_at: "2026-01-01",
      applied_by: "user-1",
      removed_at: null,
      removed_by: null,
    },
  ];

  return {
    mockRemoveMutation: vi.fn(),
    getMockAssignments: (planId?: string | null) => {
      if (planId === "empty-plan") return [];
      if (planId === "herd-plan") {
        return [
          {
            id: "as-3",
            plan_id: "herd-plan",
            target_type: "HERD" as const,
            cattle_id: null,
            animal_group_id: null,
            applied_at: "2026-01-01",
            applied_by: "user-1",
            removed_at: null,
            removed_by: null,
          },
        ];
      }
      return defaultItems;
    },
  };
});

vi.mock("@/lib/auth/permissions", () => ({
  Can: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useCan: () => () => true,
}));

vi.mock("../../hooks/use-feed-plans", () => ({
  useFeedPlanAssignments: (planId?: string | null) => ({
    isLoading: false,
    data: {
      items: getMockAssignments(planId),
    },
  }),
  useRemoveFeedAssignment: () => ({
    mutateAsync: mockRemoveMutation,
    isPending: false,
  }),
}));

vi.mock("@/features/cattle/hooks/use-cattle", () => ({
  useAnimalGroups: () => ({
    data: {
      items: [{ id: "grp-1", name: "Milkers Shed A", memberCount: 5, description: null }],
    },
  }),
}));

vi.mock("@/features/cattle/api", () => ({
  cattleApi: {
    findOne: vi.fn().mockResolvedValue({
      id: "cow-1",
      name: "Tuni",
      tagNumber: "GALIB-006",
      breed: { id: "b1", name: "Friesian" },
      shed: { id: "s1", name: "Shed 1", code: "S1" },
      profile_photo: null,
      image: null,
    }),
  },
}));

vi.mock("@/features/cattle/context/cattle-detail-modal-context", () => ({
  useCattleDetailModal: () => ({
    openCattleDetail: vi.fn(),
  }),
}));

const mockPlan: FeedPlan = {
  id: "plan-1",
  name: "High Yield Lactating TMR",
  kind: "PLAN",
  notes: null,
  made_for_cattle_id: null,
  made_for_animal_group_id: null,
  reference_requirement: null,
  is_active: true,
  applied_to: { cattle_ids: ["cow-1"], group_ids: ["grp-1"], herd: false },
  lines: [],
  total_kg_per_day: 41,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};

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

describe("AssignedCattleDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders header, KPI cards and assigned rows", async () => {
    renderWithProviders(
      <AssignedCattleDialog
        plan={mockPlan}
        open={true}
        onOpenChange={vi.fn()}
        onApplyMore={vi.fn()}
      />,
    );

    expect(screen.getByText("Assigned Cattle — High Yield Lactating TMR")).toBeInTheDocument();
    expect(screen.getByText("Total Cattle")).toBeInTheDocument();
    expect(screen.getByText("Total Feed Demand")).toBeInTheDocument();

    // Check direct assignment row
    await waitFor(() => {
      expect(screen.getByText("Tuni")).toBeInTheDocument();
    });
    expect(screen.getByText("GALIB-006")).toBeInTheDocument();
    expect(screen.getByText("Direct Assignment")).toBeInTheDocument();

    // Check group row
    expect(screen.getByText("Group: Milkers Shed A")).toBeInTheDocument();
    expect(screen.getByText("Group Assignment")).toBeInTheDocument();
  });

  it("filters rows by search query", async () => {
    renderWithProviders(
      <AssignedCattleDialog
        plan={mockPlan}
        open={true}
        onOpenChange={vi.fn()}
        onApplyMore={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Tuni")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search cows by name or tag number...");
    fireEvent.change(searchInput, { target: { value: "GALIB-006" } });

    expect(screen.getByText("Tuni")).toBeInTheDocument();
    expect(screen.queryByText("Group: Milkers Shed A")).not.toBeInTheDocument();
  });

  it("opens ConfirmDialog when remove is clicked and formats description without empty ()", async () => {
    renderWithProviders(
      <AssignedCattleDialog
        plan={mockPlan}
        open={true}
        onOpenChange={vi.fn()}
        onApplyMore={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Tuni")).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByRole("button", { name: /Remove/i });
    fireEvent.click(removeButtons[0]);

    // Check confirmation title and formatted target with tag
    await waitFor(() => {
      expect(screen.getByText(/Remove Tuni from this plan\?/i)).toBeInTheDocument();
      expect(screen.getByText(/Tuni \(GALIB-006\) will no longer receive this feed ration/i)).toBeInTheDocument();
      expect(screen.queryByText(/\(\s*\)/)).not.toBeInTheDocument();
    });
  });

  it("handles case-insensitive search by tag number and cow name", async () => {
    renderWithProviders(
      <AssignedCattleDialog
        plan={mockPlan}
        open={true}
        onOpenChange={vi.fn()}
        onApplyMore={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Tuni")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search cows by name or tag number...");

    // Search by lowercase tag number
    fireEvent.change(searchInput, { target: { value: "galib-006" } });
    expect(screen.getByText("Tuni")).toBeInTheDocument();
    expect(screen.queryByText("Group: Milkers Shed A")).not.toBeInTheDocument();

    // Search by lowercase cow name
    fireEvent.change(searchInput, { target: { value: "tuni" } });
    expect(screen.getByText("Tuni")).toBeInTheDocument();
    expect(screen.queryByText("Group: Milkers Shed A")).not.toBeInTheDocument();
  });

  it("filters rows by group name", async () => {
    renderWithProviders(
      <AssignedCattleDialog
        plan={mockPlan}
        open={true}
        onOpenChange={vi.fn()}
        onApplyMore={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Tuni")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search cows by name or tag number...");
    fireEvent.change(searchInput, { target: { value: "milkers" } });

    expect(screen.queryByText("Tuni")).not.toBeInTheDocument();
    expect(screen.getByText("Group: Milkers Shed A")).toBeInTheDocument();
  });

  it("filters rows by target type buttons (ALL, Direct, Group)", async () => {
    renderWithProviders(
      <AssignedCattleDialog
        plan={mockPlan}
        open={true}
        onOpenChange={vi.fn()}
        onApplyMore={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Tuni")).toBeInTheDocument();
    });

    // Click Direct filter
    const directBtn = screen.getByRole("button", { name: /Direct \(1\)/i });
    fireEvent.click(directBtn);
    expect(screen.getByText("Tuni")).toBeInTheDocument();
    expect(screen.queryByText("Group: Milkers Shed A")).not.toBeInTheDocument();

    // Click Group filter
    const groupBtn = screen.getByRole("button", { name: /Group \(1\)/i });
    fireEvent.click(groupBtn);
    expect(screen.queryByText("Tuni")).not.toBeInTheDocument();
    expect(screen.getByText("Group: Milkers Shed A")).toBeInTheDocument();

    // Click All filter
    const allBtn = screen.getByRole("button", { name: /All Cattle \(2\)/i });
    fireEvent.click(allBtn);
    expect(screen.getByText("Tuni")).toBeInTheDocument();
    expect(screen.getByText("Group: Milkers Shed A")).toBeInTheDocument();
  });

  it("renders empty state cleanly without NaN when plan has 0 assignments", () => {
    const emptyPlan: FeedPlan = {
      ...mockPlan,
      id: "empty-plan",
      applied_to: { cattle_ids: [], group_ids: [], herd: false },
      total_kg_per_day: 0,
    };

    renderWithProviders(
      <AssignedCattleDialog
        plan={emptyPlan}
        open={true}
        onOpenChange={vi.fn()}
        onApplyMore={vi.fn()}
      />,
    );

    expect(screen.getByText("No cattle assigned to this plan yet")).toBeInTheDocument();
    expect(screen.getAllByText("0.0").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/\bNaN\b/)).not.toBeInTheDocument();
  });

  it("handles herd assignment and search by herd keyword (whole, default, পাল, সব)", () => {
    const herdPlan: FeedPlan = {
      ...mockPlan,
      id: "herd-plan",
      applied_to: { cattle_ids: [], group_ids: [], herd: true },
    };

    renderWithProviders(
      <AssignedCattleDialog
        plan={herdPlan}
        open={true}
        onOpenChange={vi.fn()}
        onApplyMore={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Whole Herd Default").length).toBeGreaterThanOrEqual(1);
    // Check isHerdOnly demand format (no "× 0 cattle")
    expect(screen.getByText("41.0 kg/head · Whole Herd Default")).toBeInTheDocument();
    expect(screen.queryByText(/× 0 cattle/)).not.toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText("Search cows by name or tag number...");

    // Test English and Bengali herd keywords
    for (const keyword of ["herd", "whole", "default", "পাল", "সব"]) {
      fireEvent.change(searchInput, { target: { value: keyword } });
      expect(screen.getAllByText("Whole Herd Default").length).toBeGreaterThanOrEqual(1);
    }
  });

  it("shows no-match search empty state and allows resetting search", async () => {
    renderWithProviders(
      <AssignedCattleDialog
        plan={mockPlan}
        open={true}
        onOpenChange={vi.fn()}
        onApplyMore={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Tuni")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search cows by name or tag number...");
    fireEvent.change(searchInput, { target: { value: "non-existent-search-term" } });

    expect(screen.getByText(/No cattle match "non-existent-search-term"/i)).toBeInTheDocument();
    const resetBtn = screen.getByRole("button", { name: /Reset search/i });
    fireEvent.click(resetBtn);

    expect(screen.getByText("Tuni")).toBeInTheDocument();
  });
});

