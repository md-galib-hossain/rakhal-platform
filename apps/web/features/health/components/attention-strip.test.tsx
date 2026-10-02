import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import bn from "@/i18n/messages/bn.json";
import { AttentionStrip } from "./attention-strip";

const h = vi.hoisted(() => ({
  setParams: vi.fn(),
  tasks: undefined as unknown,
  withdrawals: undefined as unknown,
}));
vi.mock("nuqs", () => ({
  parseAsString: {},
  useQueryStates: () => [{}, h.setParams],
}));
vi.mock("../hooks/use-health", () => ({
  useHealthTasks: () => ({ data: h.tasks }),
  useSafetyWithdrawals: () => ({ data: h.withdrawals }),
}));

const day = (offset: number, h2 = 12) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(h2, 0, 0, 0);
  return d.toISOString();
};
const step = (id: string, title: string, offset: number, status = "PENDING") => ({ id, cattleId: id, title, taskType: "MEDICINE", medicineName: null, dueDateTime: day(offset), status });
const withdrawal = (healthCaseId: string, cattleId: string, milk: number | null, meat: number | null) => ({ healthCaseId, cattleId, milkDaysRemaining: milk, meatDaysRemaining: meat });

function renderStrip(locale: "en" | "bn" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn} timeZone="Asia/Dhaka">
      <AttentionStrip />
    </NextIntlClientProvider>,
  );
}

describe("AttentionStrip (RFE-134)", () => {
  beforeEach(() => {
    h.setParams.mockClear();
    h.tasks = { items: [step("a", "Late", -2), step("b", "Late", -2), step("c", "Today", 0), step("d", "Later", 5)] };
    h.withdrawals = { items: [withdrawal("c1", "x", 1, 1), withdrawal("c2", "y", 9, 2), withdrawal("c3", "z", 0, 0)] };
  });

  it("counts overdue steps, steps due today and withdrawals ending within 3 days", () => {
    renderStrip();
    const group = screen.getByRole("group", { name: "Needs attention" });
    expect(group.textContent).toContain("1Overdue steps");
    expect(group.textContent).toContain("1Due today");
    expect(group.textContent).toContain("2Withdrawals ending in 3 days"); // c1 (1 day) and c3 (clears today); c2 has 9 left
  });

  it("each tile deep-links to the filtered view", () => {
    renderStrip();
    fireEvent.click(screen.getByRole("button", { name: /Overdue steps/ }));
    expect(h.setParams).toHaveBeenLastCalledWith({ healthTab: "schedule", bucket: "overdue", date: null });
    fireEvent.click(screen.getByRole("button", { name: /Due today/ }));
    expect(h.setParams).toHaveBeenLastCalledWith({ healthTab: "schedule", bucket: "today", date: null });
    fireEvent.click(screen.getByRole("button", { name: /Withdrawals ending/ }));
    expect(h.setParams).toHaveBeenLastCalledWith({ healthTab: "treatments", bucket: null, date: null });
  });

  it("says so calmly when nothing needs attention", () => {
    h.tasks = { items: [step("d", "Later", 5)] };
    h.withdrawals = { items: [withdrawal("c2", "y", 9, 2)] };
    renderStrip();
    expect(screen.getByText("Nothing needs attention right now.")).toBeTruthy();
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("renders nothing until both lists have loaded", () => {
    h.tasks = undefined;
    const { container } = renderStrip();
    expect(container.textContent).toBe("");
  });

  it("renders in Bengali with no missing-message keys", () => {
    const { container } = renderStrip("bn");
    expect(container.textContent).not.toMatch(/health\.managementCenter/);
  });
});
