import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import type { HealthPlanListItem, HealthPlanStats } from "../types";
import { HealthPlanCard } from "./health-plan-card";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/auth/permissions", () => ({ Can: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("../hooks/use-health", () => ({ useDeletePlan: () => ({ mutateAsync: vi.fn(), isPending: false }) }));

const baseStats: HealthPlanStats = {
  kind: "TREATMENT",
  appliedTo: 5,
  inProgress: 0,
  recovered: 3,
  mortality: 1,
  recoveryRate: 75,
  completed: null,
  due: null,
  coverageRate: null,
  stepsDue: 0,
  stepsOverdue: 0,
  nextDueDate: null,
};

function plan(over: Partial<HealthPlanListItem> = {}, stats: Partial<HealthPlanStats> = {}): HealthPlanListItem {
  return {
    id: "p1",
    name: "Mastitis 5-day",
    category: "TREATMENT",
    planType: "MEDICAL",
    description: null,
    diagnosis: null,
    condition: "MASTITIS",
    cycleLengthDays: 5,
    totalActionSteps: 2,
    isTemplate: false,
    steps: [
      { id: "s1", dayNumber: 1, title: "Penicillin", instruction: "Inject 5 ml" },
      { id: "s2", dayNumber: 2, title: "Rest", instruction: null },
    ] as HealthPlanListItem["steps"],
    stats: { ...baseStats, ...stats },
    ...over,
  };
}

function renderCard(p: HealthPlanListItem, handlers = { onEdit: vi.fn(), onApply: vi.fn(), onOpen: vi.fn() }) {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
      <HealthPlanCard plan={p} {...handlers} />
    </NextIntlClientProvider>,
  );
  return handlers;
}

describe("HealthPlanCard — live state, details in a sheet, Apply first (RFE-142, RFE-143)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("a protocol nobody is on shows no 'running' row at all", () => {
    renderCard(plan({}, { inProgress: 0 }));
    expect(screen.queryByText(/in progress/)).toBeNull();
    expect(screen.queryByRole("group", { name: "Running now" })).toBeNull();
  });

  it("a running protocol shows how many animals are on it", () => {
    renderCard(plan({}, { inProgress: 3 }));
    expect(screen.getByRole("group", { name: "Running now" })).toBeTruthy();
    expect(screen.getByText("3 animals in progress")).toBeTruthy();
  });

  it("overdue and due-today steps show as chips on that card, with counts", () => {
    renderCard(plan({}, { inProgress: 3, stepsOverdue: 2, stepsDue: 1 }));
    expect(screen.getByText("2 steps overdue")).toBeTruthy();
    expect(screen.getByText("1 step due today")).toBeTruthy();
    expect(screen.queryByText(/Next step/)).toBeNull();
  });

  it("with nothing late or due today it shows the next due day instead", () => {
    renderCard(plan({}, { inProgress: 1, nextDueDate: "2026-10-05" }));
    expect(screen.getByText("Next step Oct 5")).toBeTruthy(); // the farm day as written, never shifted by timezone
  });

  it("the step sequence is not on the card any more - it lives in the protocol sheet", () => {
    renderCard(plan());
    expect(screen.queryByText("Inject 5 ml")).toBeNull();
    expect(screen.queryByRole("button", { name: /Show all/ })).toBeNull();
  });

  it("the title and Details both open the protocol sheet", () => {
    const p = plan();
    const { onOpen } = renderCard(p);
    fireEvent.click(screen.getByRole("button", { name: "Mastitis 5-day" }));
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onOpen).toHaveBeenCalledWith(p);
  });

  it("a deleted protocol can still be opened (its animals are still on it)", () => {
    const p = plan({ deletedAt: "2026-10-01T00:00:00.000Z" }, { inProgress: 2 });
    const { onOpen } = renderCard(p);
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(onOpen).toHaveBeenCalledWith(p);
  });

  it("Apply is the primary action and opens the apply flow for this protocol", () => {
    const p = plan();
    const { onApply, onEdit } = renderCard(p);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith(p);
    fireEvent.click(screen.getByRole("button", { name: "Edit Plan" }));
    expect(onEdit).toHaveBeenCalledWith(p);
  });

  it("a protocol deleted while animals are on it is flagged, and cannot be applied, edited or deleted", () => {
    const { onApply } = renderCard(plan({ deletedAt: "2026-10-01T00:00:00.000Z" }, { inProgress: 2 }));
    expect(screen.getByText("Deleted")).toBeTruthy();
    expect(screen.getByText(/animals are still on it/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Edit Plan" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Delete Plan" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).not.toHaveBeenCalled();
    // its animals are still counted
    expect(screen.getByText("2 animals in progress")).toBeTruthy();
  });

  it("deleting a protocol that animals are on warns how many", () => {
    renderCard(plan({}, { inProgress: 4 }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Plan" }));
    expect(screen.getByText(/4 animals are still on this protocol/)).toBeTruthy();
  });
});
