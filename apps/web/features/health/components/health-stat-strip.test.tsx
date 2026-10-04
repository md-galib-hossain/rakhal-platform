import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import en from "@/i18n/messages/en.json";
import { HealthStatStrip } from "./health-stat-strip";

const h = vi.hoisted(() => ({
  state: { isLoading: false, isError: false, data: undefined as unknown, refetch: undefined as unknown },
  rounds: { items: [] as Array<{ stepsOverdue: number }>, isSuccess: true },
}));

vi.mock("../hooks/use-health", () => ({
  useHealthDashboard: () => h.state,
  useRounds: () => ({ data: { items: h.rounds.items }, isSuccess: h.rounds.isSuccess }),
}));

const dashboard = {
  herdHealthScore: 92,
  healthyAnimalCount: 46,
  totalAnimalCount: 50,
  sickBayCount: 3,
  medicineExpense: 1500,
  safetyWithdrawalCount: 2,
  morbidityTrend: [],
};

function renderStrip(onUrlUpdate = vi.fn()) {
  const Adapter = withNuqsTestingAdapter({ onUrlUpdate });
  render(
    <Adapter>
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
        <HealthStatStrip />
      </NextIntlClientProvider>
    </Adapter>,
  );
  return { onUrlUpdate };
}

describe("HealthStatStrip (RFE-140)", () => {
  beforeEach(() => {
    h.state = { isLoading: false, isError: false, data: dashboard, refetch: vi.fn() };
    h.rounds = { items: [], isSuccess: true };
  });

  it("is five plain numbers — and none of the old attention tiles", () => {
    renderStrip();
    expect(screen.getByText("Late steps")).toBeTruthy();
    expect(screen.getByText("Sick now")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("92%")).toBeTruthy();
    expect(screen.getByText("46 of 50 animals")).toBeTruthy();
    expect(screen.getByText("Milk/meat withheld")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("Medicine cost")).toBeTruthy();
    expect(screen.queryByText(/overdue/i)).toBeNull();
    expect(screen.queryByText(/due today/i)).toBeNull();
    expect(screen.queryByText(/ending in/i)).toBeNull();
  });

  it("the sick tile opens the Sick Bay list, the withheld tile opens the withheld list", async () => {
    const { onUrlUpdate } = renderStrip();
    const lastParam = (key: string) => onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get(key);

    fireEvent.click(screen.getByRole("button", { name: /Sick now/ }));
    // nuqs batches URL writes, so wait for the update rather than reading it synchronously
    await waitFor(() => expect(lastParam("bay")).toBe("cases"));
    expect(lastParam("healthTab")).toBe("treatments");

    fireEvent.click(screen.getByRole("button", { name: /Milk\/meat withheld/ }));
    await waitFor(() => expect(lastParam("bay")).toBe("withheld"));
  });

  it("the other two tiles are not buttons", () => {
    renderStrip();
    expect(screen.queryByRole("button", { name: /Herd healthy/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Medicine cost/ })).toBeNull();
  });

  describe("Late steps tile (RFE-150)", () => {
    it("adds up the late steps across running rounds and says in how many rounds", () => {
      h.rounds.items = [{ stepsOverdue: 2 }, { stepsOverdue: 0 }, { stepsOverdue: 1 }];
      renderStrip();
      const tile = screen.getByRole("button", { name: /Late steps/ });
      expect(tile.textContent).toContain("3");
      expect(tile.textContent).toContain("in 2 rounds");
    });

    it("says all on time at zero, without the warning tone", () => {
      renderStrip();
      const tile = screen.getByRole("button", { name: /Late steps/ });
      expect(tile.textContent).toContain("0");
      expect(tile.textContent).toContain("All on time");
      expect(tile.querySelector(".text-warning")).toBeNull();
    });

    it("shows a dash, not a false zero, while the rounds are not loaded", () => {
      h.rounds = { items: [], isSuccess: false };
      renderStrip();
      expect(screen.getByRole("button", { name: /Late steps/ }).textContent).toContain("—");
    });

    it("opens Protocols -> Applied on Needs action", async () => {
      h.rounds.items = [{ stepsOverdue: 1 }];
      const { onUrlUpdate } = renderStrip();
      fireEvent.click(screen.getByRole("button", { name: /Late steps/ }));
      await waitFor(() => expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get("status")).toBe("needs"));
      expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get("healthTab")).toBe("protocols");
    });
  });

  it("an error shows a one-line retry instead of an empty gap", () => {
    const refetch = vi.fn();
    h.state = { isLoading: false, isError: true, data: undefined, refetch };
    renderStrip();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });
});
