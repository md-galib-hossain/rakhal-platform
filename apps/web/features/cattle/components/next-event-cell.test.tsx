import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import bn from "@/i18n/messages/bn.json";
import type { CattleListItem, UpcomingEvent } from "../types";
import { NextEventCell } from "./next-event-cell";

const useUpcomingEvents = vi.fn();
vi.mock("../hooks/use-cattle", () => ({
  useUpcomingEvents: (id: string, enabled: boolean) => useUpcomingEvents(id, enabled) as unknown,
}));

function event(over: Partial<UpcomingEvent> = {}): UpcomingEvent {
  return {
    kind: "HEALTH_STEP",
    labelKey: "cattle.upcoming.healthStep",
    labelParams: { title: "Antibiotic day 2" },
    dueAt: "2026-10-09T06:00:00.000Z",
    daysUntil: -2,
    urgency: "OVERDUE",
    actionable: true,
    ref: { type: "HEALTH_TASK", id: "ht1" },
    ...over,
  };
}

function cow(over: Partial<CattleListItem> = {}): CattleListItem {
  return {
    id: "c1",
    name: "Bessie",
    tagNumber: "T-001",
    next_event: event(),
    upcoming_event_count: 1,
    ...over,
  } as CattleListItem;
}

function renderCell(c: CattleListItem, locale: "en" | "bn" = "en", onView = vi.fn()) {
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn} timeZone="Asia/Dhaka">
      <NextEventCell cattle={c} onView={onView} />
    </NextIntlClientProvider>,
  );
  return onView;
}

describe("NextEventCell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUpcomingEvents.mockReturnValue({ isLoading: false, isError: false, data: { events: [event()], total: 1 }, refetch: vi.fn() });
  });

  it("shows a dash and no button when nothing is upcoming", () => {
    renderCell(cow({ next_event: null, upcoming_event_count: 0 }));
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the label, how overdue it is, and the date", () => {
    renderCell(cow());
    expect(screen.getByText("Antibiotic day 2")).toBeInTheDocument();
    expect(screen.getByText(/2d overdue/)).toBeInTheDocument();
    expect(screen.getByText(/Oct 9, 2026/)).toBeInTheDocument();
  });

  it("shows a +N hint only when more events exist", () => {
    const { unmount } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <NextEventCell cattle={cow({ upcoming_event_count: 3 })} onView={vi.fn()} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("+2 more")).toBeInTheDocument();
    unmount();

    renderCell(cow({ upcoming_event_count: 1 }));
    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
  });

  it("names the relative day for today, tomorrow and later", () => {
    const cases: Array<[number, RegExp]> = [
      [0, /Today/],
      [1, /Tomorrow/],
      [5, /in 5d/],
    ];
    for (const [days, text] of cases) {
      const { unmount } = render(
        <NextIntlClientProvider locale="en" messages={en}>
          <NextEventCell
            cattle={cow({ next_event: event({ daysUntil: days, urgency: days === 5 ? "LATER" : "DUE_SOON" }) })}
            onView={vi.fn()}
          />
        </NextIntlClientProvider>,
      );
      expect(screen.getByText(text)).toBeInTheDocument();
      unmount();
    }
  });

  it("uses the translated label for system events", () => {
    renderCell(
      cow({
        next_event: event({ kind: "PREGNANCY_CHECK", labelKey: "cattle.upcoming.pregnancyCheck", labelParams: undefined }),
      }),
    );
    expect(screen.getByText("Pregnancy check")).toBeInTheDocument();
  });

  it("does not load the events until the popover is opened", () => {
    renderCell(cow());
    // The list sits inside the popover content, which is not mounted while closed: no request at all.
    expect(useUpcomingEvents).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Bessie/ }));
    expect(useUpcomingEvents).toHaveBeenLastCalledWith("c1", true);
  });

  it("lists every event in the popover, marks information-only ones, and opens the animal", () => {
    useUpcomingEvents.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        total: 2,
        events: [
          event(),
          event({
            kind: "WITHDRAWAL_END",
            labelKey: "cattle.upcoming.milkWithdrawalEnd",
            labelParams: undefined,
            daysUntil: 2,
            urgency: "DUE_SOON",
            actionable: false,
            ref: { type: "SAFETY_WITHDRAWAL", id: "w1" },
          }),
        ],
      },
      refetch: vi.fn(),
    });
    const onView = renderCell(cow({ upcoming_event_count: 2 }));
    fireEvent.click(screen.getByRole("button", { name: /Bessie/ }));

    expect(screen.getByText("Upcoming events")).toBeInTheDocument();
    expect(screen.getByText("Milk safe again")).toBeInTheDocument();
    expect(screen.getByText(/· Info/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View animal" }));
    expect(onView).toHaveBeenCalledTimes(1);
  });

  it("shows a loading state while the list loads", () => {
    useUpcomingEvents.mockReturnValue({ isLoading: true, isError: false, data: undefined, refetch: vi.fn() });
    renderCell(cow());
    fireEvent.click(screen.getByRole("button", { name: /Bessie/ }));
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("offers a retry when the list fails to load", () => {
    const refetch = vi.fn();
    useUpcomingEvents.mockReturnValue({ isLoading: false, isError: true, data: undefined, refetch });
    renderCell(cow());
    fireEvent.click(screen.getByRole("button", { name: /Bessie/ }));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("renders in Bangla without leaking a raw translation key", () => {
    renderCell(
      cow({
        next_event: event({ kind: "CALVING", labelKey: "cattle.upcoming.calving", labelParams: undefined, daysUntil: 3, urgency: "DUE_SOON" }),
      }),
      "bn",
    );
    expect(screen.getByText("প্রসবের সম্ভাব্য সময়")).toBeInTheDocument();
    expect(screen.getByText(/৩ দিন পরে|3 দিন পরে/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/cattle\.upcoming/);
  });
});
