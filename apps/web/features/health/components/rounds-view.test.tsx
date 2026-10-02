import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import type { ProtocolRound } from "../types";
import { RoundsView } from "./rounds-view";

const h = vi.hoisted(() => ({
  filters: [] as Array<Record<string, unknown>>,
  items: [] as unknown[],
  hasNextPage: false,
  isLoading: false,
  isError: false,
}));

vi.mock("../hooks/use-health", () => ({
  useRounds: (filters: Record<string, unknown>) => {
    h.filters.push(filters);
    return { data: { items: h.items, meta: { hasNextPage: h.hasNextPage } }, isLoading: h.isLoading, isError: h.isError, isFetching: false, refetch: vi.fn() };
  },
}));
vi.mock("./round-card", () => ({
  RoundCard: ({ round, onOpen }: { round: { roundKey: string }; onOpen: (r: unknown) => void }) => (
    <button type="button" data-testid="round" onClick={() => onOpen(round)}>
      {round.roundKey}
    </button>
  ),
}));

const round = (key: string, over: Partial<ProtocolRound> = {}) => ({ roundKey: key, stepsOverdue: 0, stepsDueToday: 0, nextDueDate: null, startDate: "2026-10-01", ...over }) as unknown as ProtocolRound;

function renderView(props: Partial<Parameters<typeof RoundsView>[0]> = {}) {
  const onOpen = vi.fn();
  const onShowLibrary = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
      <RoundsView kind="ALL" search="" finished={false} onOpen={onOpen} onShowLibrary={onShowLibrary} {...props} />
    </NextIntlClientProvider>,
  );
  return { onOpen, onShowLibrary };
}
const keys = () => screen.getAllByTestId("round").map((n) => n.textContent);
const lastFilters = () => h.filters.at(-1) ?? {};

describe("RoundsView (RFE-146)", () => {
  beforeEach(() => {
    h.filters = [];
    h.items = [];
    h.hasNextPage = false;
    h.isLoading = false;
    h.isError = false;
  });

  it("asks for running rounds, with the kind and search the page is filtering by", () => {
    renderView({ kind: "PREVENTION", search: "fmd" });
    expect(lastFilters()).toEqual({ status: "RUNNING", kind: "PREVENTION", search: "fmd" });
  });

  it("with the Finished switch it asks for finished rounds, and 'all kinds' / no search send nothing", () => {
    renderView({ finished: true });
    expect(lastFilters()).toEqual({ status: "FINISHED", kind: undefined, search: undefined });
  });

  it("running rounds come most urgent first: late, due today, soonest next step", () => {
    h.items = [
      round("quiet", { nextDueDate: "2026-10-09" }),
      round("today", { stepsDueToday: 2 }),
      round("late", { stepsOverdue: 1 }),
      round("nothing"),
    ];
    renderView();
    expect(keys()).toEqual(["late", "today", "quiet", "nothing"]);
  });

  it("finished rounds keep the server's order (newest first)", () => {
    h.items = [round("newer", { startDate: "2026-10-02" }), round("older", { startDate: "2026-09-01" }), round("late", { stepsOverdue: 9 })];
    renderView({ finished: true });
    expect(keys()).toEqual(["newer", "older", "late"]);
  });

  it("opens the round that was clicked", () => {
    h.items = [round("a")];
    const { onOpen } = renderView();
    fireEvent.click(screen.getByTestId("round"));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ roundKey: "a" }));
  });

  it("nothing running: says so and points at the Library", () => {
    const { onShowLibrary } = renderView();
    expect(screen.getByText("Nothing is running")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open the Library" }));
    expect(onShowLibrary).toHaveBeenCalled();
  });

  it("no finished rounds: a different message, no Library button", () => {
    renderView({ finished: true });
    expect(screen.getByText("No finished rounds")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open the Library" })).toBeNull();
  });

  it("a filter that matches nothing says 'no rounds match' rather than 'nothing is running'", () => {
    renderView({ kind: "TREATMENT" });
    expect(screen.getByText("No rounds match")).toBeTruthy();
    expect(screen.queryByText("Nothing is running")).toBeNull();
  });

  it("says when it is showing only the first 100 rounds", () => {
    h.items = [round("a")];
    h.hasNextPage = true;
    renderView();
    expect(screen.getByText("Showing the first 100 rounds.")).toBeTruthy();
  });

  it("shows an error with a retry instead of an empty list", () => {
    h.isError = true;
    renderView();
    expect(screen.getByText("Could not load the rounds.")).toBeTruthy();
  });

  it("shows placeholders while loading", () => {
    h.isLoading = true;
    renderView();
    expect(screen.queryByTestId("round")).toBeNull();
    expect(screen.queryByText("Nothing is running")).toBeNull();
  });
});
