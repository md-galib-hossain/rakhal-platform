import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import type { ProtocolRound } from "../types";
import { farmDay, RoundCard } from "./round-card";

const round = (over: Partial<ProtocolRound> = {}): ProtocolRound => ({
  roundKey: "app:r1",
  healthPlan: { id: "p1", name: "FMD vaccine", category: "VACCINATION", deletedAt: null },
  kind: "PREVENTION",
  startDate: "2026-10-02",
  animalCount: 12,
  stepsTotal: 24,
  stepsDone: 9,
  stepsSkipped: 0,
  stepsOverdue: 0,
  stepsDueToday: 0,
  nextDueDate: null,
  status: "RUNNING",
  ...over,
});

function renderCard(r: ProtocolRound, onOpen = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
      <RoundCard round={r} onOpen={onOpen} />
    </NextIntlClientProvider>,
  );
  return { onOpen };
}

describe("farmDay", () => {
  it("is the farm calendar day at local noon, so formatting never slips a day", () => {
    const d = farmDay("2026-10-02");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 2, 12]);
  });
});

describe("RoundCard (RFE-146)", () => {
  it("shows the protocol, when it was applied, how many animals and how far along", () => {
    renderCard(round());
    expect(screen.getByText("FMD vaccine")).toBeTruthy();
    expect(screen.getByText("Started Oct 2")).toBeTruthy();
    expect(screen.getByText("12 animals")).toBeTruthy();
    expect(screen.getByText("9 of 24 steps done")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("38");
    expect(screen.getByText("Prevention")).toBeTruthy();
  });

  it("flags what needs doing: late steps in red, due today in amber", () => {
    renderCard(round({ stepsOverdue: 2, stepsDueToday: 1 }));
    expect(screen.getByText("2 steps overdue")).toBeTruthy();
    expect(screen.getByText("1 step due today")).toBeTruthy();
    expect(screen.queryByText("Nothing due")).toBeNull();
  });

  it("with nothing due, says when the next step is — or that nothing is due", () => {
    const { rerender } = render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
        <RoundCard round={round({ nextDueDate: "2026-10-09" })} onOpen={vi.fn()} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Next step Oct 9")).toBeTruthy();
    rerender(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
        <RoundCard round={round({ nextDueDate: null })} onOpen={vi.fn()} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Nothing due")).toBeTruthy();
  });

  it("a finished round says so and shows no due / next line", () => {
    renderCard(round({ status: "FINISHED", stepsDone: 24, nextDueDate: "2026-10-09" }));
    expect(screen.getByText("Finished")).toBeTruthy();
    expect(screen.queryByText(/Next step/)).toBeNull();
    expect(screen.queryByText("Nothing due")).toBeNull();
  });

  it("flags a protocol that was deleted while animals are still on it", () => {
    renderCard(round({ healthPlan: { id: "p1", name: "FMD vaccine", category: "VACCINATION", deletedAt: "2026-10-01T00:00:00.000Z" } }));
    expect(screen.getByText("Deleted")).toBeTruthy();
  });

  it("a round with no steps reads 0%, not NaN", () => {
    renderCard(round({ stepsTotal: 0, stepsDone: 0 }));
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
  });

  it("the name and the Open button both open the round", () => {
    const { onOpen } = renderCard(round());
    fireEvent.click(screen.getByRole("button", { name: /Open the round of FMD vaccine, started Oct 2/ }));
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ roundKey: "app:r1" }));
  });
});
