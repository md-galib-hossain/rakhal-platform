import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import bn from "@/i18n/messages/bn.json";
import type { TimelineEvent } from "../../timeline-model";
import { AnimalTimeline } from "./animal-timeline";

// The row menu reads the session and the query client; its rule is covered in row-actions/permissions.test.ts.
vi.mock("./row-actions/row-actions", () => ({ RowActions: () => null }));

const useAnimalTimeline = vi.fn();
vi.mock("../../hooks/use-animal-timeline", () => ({
  useAnimalTimeline: (args: unknown) => useAnimalTimeline(args) as unknown,
}));

const ev = (id: string, type: TimelineEvent["type"], eventAt: string, over: Partial<TimelineEvent> = {}): TimelineEvent => ({
  id, type, eventAt, provenance: "RECORDED", status: "ACTIVE", notes: null, findings: null, batchId: null, sourceEventId: null, detail: null, ...over,
});

function state(over: Record<string, unknown> = {}) {
  return {
    source: "route", items: [], isLoading: false, isError: false, refetch: vi.fn(), hasNextPage: false,
    isFetchingNextPage: false, isNextPageError: false, fetchNextPage: vi.fn(), ...over,
  };
}

function renderTimeline(locale: "en" | "bn" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn} timeZone="Asia/Dhaka">
      <AnimalTimeline cattleId="c1" gender="FEMALE" animalCategory="COW" />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("AnimalTimeline", () => {
  it("shows the empty state", () => {
    useAnimalTimeline.mockReturnValue(state());
    renderTimeline();
    expect(screen.getByText("No events yet.")).toBeInTheDocument();
  });

  it("shows the error state with a retry", () => {
    const refetch = vi.fn();
    useAnimalTimeline.mockReturnValue(state({ isError: true, refetch }));
    renderTimeline();
    expect(screen.getByText("Could not load the timeline.")).toBeInTheDocument();
  });

  it("groups rows by day, newest first, with the rows' own types", () => {
    useAnimalTimeline.mockReturnValue(
      state({ items: [ev("a", "WEIGHT", "2026-10-28T07:00:00", { detail: { weightKg: 412 } }), ev("b", "BREEDING", "2026-09-21T07:00:00")] }),
    );
    renderTimeline();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
    expect(screen.getByText("Weighed")).toBeInTheDocument();
    expect(screen.getByText("AI / service")).toBeInTheDocument();
  });

  it("passes the chosen filter and Show voided to the hook", () => {
    useAnimalTimeline.mockReturnValue(state());
    renderTimeline();
    expect(useAnimalTimeline).toHaveBeenLastCalledWith(expect.objectContaining({ group: null, includeVoided: false }));
    fireEvent.click(screen.getByRole("button", { name: "Health" }));
    expect(useAnimalTimeline).toHaveBeenLastCalledWith(expect.objectContaining({ group: "HEALTH" }));
    fireEvent.click(screen.getByLabelText("Show voided"));
    expect(useAnimalTimeline).toHaveBeenLastCalledWith(expect.objectContaining({ group: "HEALTH", includeVoided: true }));
    expect(screen.getByText("No events in this group.")).toBeInTheDocument();
  });

  it("offers Load older only while there is a next page", () => {
    const fetchNextPage = vi.fn();
    useAnimalTimeline.mockReturnValue(state({ items: [ev("a", "NOTE", "2026-10-01T07:00:00")], hasNextPage: true, fetchNextPage }));
    renderTimeline();
    fireEvent.click(screen.getByRole("button", { name: "Load older" }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("hides Load older on the last page and notes the fallback source", () => {
    useAnimalTimeline.mockReturnValue(state({ source: "fallback", items: [ev("a", "NOTE", "2026-10-01T07:00:00")] }));
    renderTimeline();
    expect(screen.queryByRole("button", { name: "Load older" })).not.toBeInTheDocument();
    expect(screen.getByText(/Showing recent history/)).toBeInTheDocument();
  });

  it("shows a retry when loading older fails but keeps the rows", () => {
    useAnimalTimeline.mockReturnValue(state({ items: [ev("a", "NOTE", "2026-10-01T07:00:00")], isNextPageError: true }));
    renderTimeline();
    expect(screen.getByText("Could not load older events.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByText("Note")).toBeInTheDocument();
  });

  it("renders the filter row in Bangla", () => {
    useAnimalTimeline.mockReturnValue(state());
    renderTimeline("bn");
    expect(screen.getByRole("button", { name: "স্বাস্থ্য" })).toBeInTheDocument();
  });
});
