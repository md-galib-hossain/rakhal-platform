import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import type { ProtocolRound } from "../types";
import { RoundAttentionStrip } from "./round-attention-strip";

const h = vi.hoisted(() => ({ items: [] as unknown[], filters: [] as Array<Record<string, unknown>> }));

vi.mock("../hooks/use-health", () => ({
  useRounds: (filters: Record<string, unknown>) => {
    h.filters.push(filters);
    return { data: { items: h.items, meta: { hasNextPage: false } } };
  },
}));

const round = (key: string, name: string, over: Partial<ProtocolRound> = {}): ProtocolRound =>
  ({
    roundKey: key,
    healthPlan: { id: `p-${key}`, name, category: "VACCINATION", deletedAt: null },
    kind: "PREVENTION",
    startDate: "2026-10-02",
    animalCount: 12,
    stepsTotal: 6,
    stepsDone: 1,
    stepsSkipped: 0,
    stepsOverdue: 0,
    stepsDueToday: 0,
    nextDueDate: null,
    status: "RUNNING",
    ...over,
  }) as ProtocolRound;

function renderStrip() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
      <RoundAttentionStrip />
    </NextIntlClientProvider>,
  );
}

describe("RoundAttentionStrip (RFE-150)", () => {
  beforeEach(() => {
    h.items = [];
    h.filters = [];
  });

  it("reads the running rounds", () => {
    renderStrip();
    expect(h.filters[0]).toEqual({ status: "RUNNING" });
  });

  it("draws nothing when no round has a late step", () => {
    h.items = [round("app:1", "FMD vaccine", { stepsDueToday: 3 }), round("app:2", "Deworming")];
    const { container } = renderStrip();
    expect(container.firstChild).toBeNull();
  });

  it("lists rounds with late steps, worst first, each linking to its round", () => {
    h.items = [round("app:1", "FMD vaccine", { stepsOverdue: 1 }), round("trt:p9:2026-10-01", "Mastitis course", { stepsOverdue: 4, animalCount: 1 }), round("app:3", "Deworming")];
    renderStrip();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(within(links[0]).getByText("Mastitis course")).toBeTruthy();
    expect(within(links[0]).getByText("4 steps late")).toBeTruthy();
    expect(within(links[0]).getByText("1 animal, started Oct 2")).toBeTruthy();
    expect(links[0].getAttribute("href")).toBe("/healthcare?healthTab=protocols&round=trt%3Ap9%3A2026-10-01");
    expect(within(links[1]).getByText("1 step late")).toBeTruthy();
    expect(links[1].getAttribute("href")).toBe("/healthcare?healthTab=protocols&round=app%3A1");
  });

  it("shows three at most and counts the rest", () => {
    h.items = [1, 2, 3, 4, 5].map((n) => round(`app:${n}`, `Round ${n}`, { stepsOverdue: n }));
    renderStrip();
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.getByText("+2 more rounds")).toBeTruthy();
    expect(screen.getByText("Round 5")).toBeTruthy();
    expect(screen.queryByText("Round 1")).toBeNull();
  });

  it("gives each link a name that says what opening it does", () => {
    h.items = [round("app:1", "FMD vaccine", { stepsOverdue: 2 })];
    renderStrip();
    expect(screen.getByRole("link", { name: "Open FMD vaccine, started Oct 2, to catch up" })).toBeTruthy();
  });
});
