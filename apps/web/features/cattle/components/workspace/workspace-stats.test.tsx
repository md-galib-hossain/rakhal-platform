import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import type { CattleDetail } from "../../types";
import { daysSince, WorkspaceStats } from "./workspace-stats";

let overview: unknown;
let repro: unknown;
vi.mock("../../hooks/use-cattle-detail-tabs", () => ({
  useCattleOverview: () => ({ data: overview }),
  useCattleReproductionSummary: () => ({ data: repro }),
}));

const cow = { id: "c1", gender: "FEMALE", dim: 217, reproductiveStatus: "OPEN" } as unknown as CattleDetail;
const show = (cattle: CattleDetail) =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <WorkspaceStats cattle={cattle} />
    </NextIntlClientProvider>,
  );

describe("WorkspaceStats", () => {
  it("shows a dash for every missing value instead of hiding the stat", () => {
    overview = undefined;
    repro = undefined;
    show({ ...cow, dim: 217 });
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.getByText("Days open")).toBeInTheDocument();
  });

  it("shows days pregnant when she is pregnant, with milk and weight", () => {
    const today = new Date().toISOString();
    overview = { recent_milk_records: [{ date: today, total_l: 11.44 }], weight_history: [{ date: today, weight_kg: 412 }], last_weight_kg: 412 };
    repro = { daysPregnant: 120, daysOpen: null };
    show({ ...cow, reproductiveStatus: "PREGNANT" });
    expect(screen.getByText("Days pregnant")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("217")).toBeInTheDocument();
    expect(screen.getByText("11.4 L")).toBeInTheDocument();
    expect(screen.getByText("412 kg")).toBeInTheDocument();
  });

  it("omits the reproduction stat for a bull", () => {
    overview = undefined;
    repro = undefined;
    show({ ...cow, gender: "MALE" } as CattleDetail);
    expect(screen.queryByText("Days open")).toBeNull();
  });
});

describe("daysSince", () => {
  it("counts calendar days", () => {
    expect(daysSince("2026-10-29T23:00:00", new Date(2026, 9, 31, 1))).toBe(2);
    expect(daysSince("2026-10-31T01:00:00", new Date(2026, 9, 31, 23))).toBe(0);
  });
});
