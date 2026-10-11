import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import bn from "@/i18n/messages/bn.json";
import type { UpcomingEvent } from "../../types";
import { UpcomingStrip } from "./upcoming-strip";

const useUpcomingEvents = vi.fn();
vi.mock("../../hooks/use-cattle", () => ({
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

function renderStrip(locale: "en" | "bn" = "en") {
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn} timeZone="Asia/Dhaka">
      <UpcomingStrip cattleId="c1" />
    </NextIntlClientProvider>,
  );
}

describe("UpcomingStrip", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads the animal's events straight away (it is always visible, unlike the popover)", () => {
    useUpcomingEvents.mockReturnValue({ isLoading: true, isError: false, data: undefined, refetch: vi.fn() });
    renderStrip();
    expect(useUpcomingEvents).toHaveBeenCalledWith("c1", true);
    expect(screen.getByText("Upcoming events")).toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("says so when nothing is upcoming", () => {
    useUpcomingEvents.mockReturnValue({ isLoading: false, isError: false, data: { events: [], total: 0 }, refetch: vi.fn() });
    renderStrip();
    expect(screen.getByText("Nothing upcoming in the next 14 days")).toBeInTheDocument();
  });

  it("lists every event with its relative date and marks information-only ones", () => {
    useUpcomingEvents.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        total: 3,
        events: [
          event(),
          event({
            kind: "PREGNANCY_CHECK",
            labelKey: "cattle.upcoming.pregnancyCheck",
            labelParams: undefined,
            daysUntil: 1,
            urgency: "DUE_SOON",
            ref: { type: "BREEDING_EVENT", id: "be1" },
          }),
          event({
            kind: "WITHDRAWAL_END",
            labelKey: "cattle.upcoming.milkWithdrawalEnd",
            labelParams: undefined,
            daysUntil: 4,
            urgency: "LATER",
            actionable: false,
            ref: { type: "SAFETY_WITHDRAWAL", id: "w1" },
          }),
        ],
      },
      refetch: vi.fn(),
    });
    renderStrip();
    expect(screen.getByText("Antibiotic day 2")).toBeInTheDocument();
    expect(screen.getByText(/2d overdue/)).toBeInTheDocument();
    expect(screen.getByText("Pregnancy check")).toBeInTheDocument();
    expect(screen.getByText("Tomorrow")).toBeInTheDocument();
    expect(screen.getByText("Milk safe again")).toBeInTheDocument();
    expect(screen.getByText(/· Info/)).toBeInTheDocument();
    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
  });

  it("says how many more exist beyond the page the server returned", () => {
    useUpcomingEvents.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { total: 14, events: [event()] },
      refetch: vi.fn(),
    });
    renderStrip();
    expect(screen.getByText("+13 more")).toBeInTheDocument();
  });

  it("offers a retry when loading fails", () => {
    const refetch = vi.fn();
    useUpcomingEvents.mockReturnValue({ isLoading: false, isError: true, data: undefined, refetch });
    renderStrip();
    expect(screen.getByText("Could not load events")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("renders in Bangla without leaking a raw translation key", () => {
    useUpcomingEvents.mockReturnValue({ isLoading: false, isError: false, data: { events: [], total: 0 }, refetch: vi.fn() });
    renderStrip("bn");
    expect(screen.getByText("আসন্ন কাজ")).toBeInTheDocument();
    expect(screen.getByText("আগামী ১৪ দিনে কিছু নেই")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/cattle\.upcoming/);
  });
});
