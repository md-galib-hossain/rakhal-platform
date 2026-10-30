import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import bn from "@/i18n/messages/bn.json";
import type { UpcomingEvent } from "@/features/cattle/types";
import { NextUp } from "./next-up";

// jsdom has no ResizeObserver; Radix popovers need one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const snoozeMutate = vi.fn();
const skipMutate = vi.fn();
const useUpcomingEvents = vi.fn();
let allowTasks = true;

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/auth/permissions", () => ({ useCan: () => () => allowTasks }));
vi.mock("@/features/cattle/hooks/use-cattle", () => ({
  useUpcomingEvents: (id: string, enabled: boolean) => useUpcomingEvents(id, enabled) as unknown,
}));
vi.mock("../../hooks/use-next-up", () => ({
  useNextUpActions: () => ({
    snooze: { mutateAsync: (args: unknown) => snoozeMutate(args) as Promise<unknown>, isPending: false },
    skip: { mutateAsync: (args: unknown) => skipMutate(args) as Promise<unknown>, isPending: false },
  }),
}));

const event = (over: Partial<UpcomingEvent> = {}): UpcomingEvent => ({
  kind: "TASK",
  labelKey: "cattle.upcoming.task",
  labelParams: { title: "Check hoof" },
  dueAt: "2026-10-30T06:00:00.000Z",
  daysUntil: 0,
  urgency: "DUE_SOON",
  actionable: true,
  ref: { type: "TASK", id: "t1" },
  ...over,
});

function renderStrip(events: UpcomingEvent[], opts: { canRecord?: boolean; locale?: "en" | "bn" } = {}) {
  useUpcomingEvents.mockReturnValue({ isLoading: false, isError: false, data: { events, total: events.length }, refetch: vi.fn() });
  const onRecord = vi.fn();
  const locale = opts.locale ?? "en";
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn} timeZone="Asia/Dhaka">
      <NextUp cattleId="c1" canRecord={opts.canRecord ?? true} onRecord={onRecord} />
    </NextIntlClientProvider>,
  );
  return onRecord;
}

beforeEach(() => {
  vi.clearAllMocks();
  allowTasks = true;
  snoozeMutate.mockResolvedValue({});
  skipMutate.mockResolvedValue({});
});

describe("NextUp", () => {
  it("shows Nothing due when there is nothing", () => {
    renderStrip([]);
    expect(screen.getByText("Nothing due")).toBeInTheDocument();
  });

  it("a preg check due offers Record only, and Record opens the matching form with the reminder ref", () => {
    const onRecord = renderStrip([event({ kind: "PREGNANCY_CHECK", labelKey: "cattle.upcoming.pregnancyCheck", ref: { type: "BREEDING_EVENT", id: "b1" } })]);
    expect(screen.queryByRole("button", { name: "Snooze" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    expect(onRecord).toHaveBeenCalledWith("PREG_CHECK", "b1");
  });

  it("a Task Hub reminder offers Snooze and Skip but no Record", () => {
    renderStrip([event()]);
    expect(screen.getByRole("button", { name: "Snooze" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record" })).not.toBeInTheDocument();
  });

  it("an information-only row has no buttons", () => {
    renderStrip([event({ kind: "WITHDRAWAL_END", labelKey: "cattle.upcoming.milkWithdrawalEnd", actionable: false, ref: { type: "SAFETY_WITHDRAWAL", id: "w1" } })]);
    expect(screen.getByText("Information only")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("hides Record when the animal cannot take events, and Snooze/Skip without task permission", () => {
    allowTasks = false;
    renderStrip([event(), event({ kind: "CALVING", ref: { type: "PREGNANCY", id: "p1" }, labelKey: "cattle.upcoming.calving" })], { canRecord: false });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("Snooze tomorrow reschedules the task through the Task Hub", async () => {
    renderStrip([event()]);
    fireEvent.click(screen.getByRole("button", { name: "Snooze" }));
    fireEvent.click(await screen.findByRole("button", { name: "Tomorrow" }));
    await waitFor(() => expect(snoozeMutate).toHaveBeenCalledTimes(1));
    const args = snoozeMutate.mock.calls[0][0] as { taskId: string; dueAt: string };
    expect(args.taskId).toBe("t1");
    expect(new Date(args.dueAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("Skip sends the reason as the cancellation note", async () => {
    renderStrip([event()]);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    fireEvent.change(await screen.findByLabelText(/Why skip it/), { target: { value: "Treated already" } });
    fireEvent.click(screen.getByRole("button", { name: "Skip it" }));
    await waitFor(() => expect(skipMutate).toHaveBeenCalledWith({ taskId: "t1", reason: "Treated already" }));
  });

  it("renders in Bangla", () => {
    renderStrip([event({ kind: "CALVING", ref: { type: "PREGNANCY", id: "p1" }, labelKey: "cattle.upcoming.calving" })], { locale: "bn" });
    expect(screen.getByRole("button", { name: "লিখুন" })).toBeInTheDocument();
  });
});
