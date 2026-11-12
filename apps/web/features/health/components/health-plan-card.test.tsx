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

function renderCard(p: HealthPlanListItem, handlers = { onEdit: vi.fn(), onApply: vi.fn() }) {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
      <HealthPlanCard plan={p} {...handlers} />
    </NextIntlClientProvider>,
  );
  return handlers;
}

describe("HealthPlanCard - a Library template: create, apply, edit only", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the name, kind, condition and the template facts (steps, cycle)", () => {
    renderCard(plan());
    expect(screen.getByRole("heading", { name: "Mastitis 5-day" })).toBeTruthy();
    expect(screen.getByText("Mastitis")).toBeTruthy();
    expect(screen.getByText("2 Action Steps")).toBeTruthy();
  });

  it("shows no progress at all: no animals in progress, no overdue / due chips, no results", () => {
    renderCard(plan({}, { inProgress: 3, stepsOverdue: 2, stepsDue: 1, nextDueDate: "2026-10-05" }));
    expect(screen.queryByText(/in progress/)).toBeNull();
    expect(screen.queryByText(/overdue/)).toBeNull();
    expect(screen.queryByText(/due today/)).toBeNull();
    expect(screen.queryByText(/Next step/)).toBeNull();
    expect(screen.queryByText(/Recovered|Recovery/i)).toBeNull();
  });

  it("has no Details button and no step sequence: those live in the Applied table", () => {
    renderCard(plan());
    expect(screen.queryByRole("button", { name: "Details" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mastitis 5-day" })).toBeNull();
    expect(screen.queryByText("Inject 5 ml")).toBeNull();
  });

  it("Apply is the primary action and opens the apply flow for this protocol; Edit opens the editor", () => {
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
  });

  it("deleting a protocol that animals are on warns how many", () => {
    renderCard(plan({}, { inProgress: 4 }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Plan" }));
    expect(screen.getByText(/4 animals are still on this protocol/)).toBeTruthy();
  });
});
