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
const openRemindMe = vi.fn();
let allowTasks = true;

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/auth/permissions", () => ({ useCan: () => () => allowTasks }));
vi.mock("@/features/cattle/hooks/use-cattle", () => ({
  useUpcomingEvents: (id: string, enabled: boolean, limit?: number) => useUpcomingEvents(id, enabled, limit) as unknown,
}));
// The composer itself is covered in the notifications tests; here only that the right entry opens it with the right anchor.
vi.mock("@/features/notifications/sheet-store", () => ({
  openRemindMe: (req: unknown) => openRemindMe(req) as unknown,
}));
vi.mock("../../hooks/use-next-up", () => ({
  useNextUpActions: () => ({
    snooze: {
      mutateAsync: (args: unknown) => snoozeMutate(args) as Promise<unknown>,
      isPending: false,
    },
    skip: {
      mutateAsync: (args: unknown) => skipMutate(args) as Promise<unknown>,
      isPending: false,
    },
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
  useUpcomingEvents.mockReturnValue({
    isLoading: false,
    isError: false,
    data: { events, total: events.length },
    refetch: vi.fn(),
  });
  const onRecord = vi.fn();
  const locale = opts.locale ?? "en";
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn} timeZone="Asia/Dhaka">
      <NextUp cattleId="c1" animal={{ id: "c1", tagNumber: "A-12", name: "Lali" }} canRecord={opts.canRecord ?? true} onRecord={onRecord} />
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
    const onRecord = renderStrip([
      event({
        kind: "PREGNANCY_CHECK",
        labelKey: "cattle.upcoming.pregnancyCheck",
        ref: { type: "BREEDING_EVENT", id: "b1" },
      }),
    ]);
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
    renderStrip([
      event({
        kind: "WITHDRAWAL_END",
        labelKey: "cattle.upcoming.milkWithdrawalEnd",
        actionable: false,
        ref: { type: "SAFETY_WITHDRAWAL", id: "w1" },
      }),
    ]);
    expect(screen.getByText("Information only")).toBeInTheDocument();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Add reminder"]);
  });

  it("hides Record when the animal cannot take events, and Snooze/Skip without task permission", () => {
    allowTasks = false;
    renderStrip(
      [
        event(),
        event({
          kind: "CALVING",
          ref: { type: "PREGNANCY", id: "p1" },
          labelKey: "cattle.upcoming.calving",
        }),
      ],
      { canRecord: false },
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("Snooze tomorrow reschedules the task through the Task Hub", async () => {
    renderStrip([event()]);
    fireEvent.click(screen.getByRole("button", { name: "Snooze" }));
    fireEvent.click(await screen.findByRole("button", { name: "Tomorrow" }));
    await waitFor(() => expect(snoozeMutate).toHaveBeenCalledTimes(1));
    const args = snoozeMutate.mock.calls[0][0] as {
      taskId: string;
      dueAt: string;
    };
    expect(args.taskId).toBe("t1");
    expect(new Date(args.dueAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("Skip sends the reason as the cancellation note", async () => {
    renderStrip([event()]);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    fireEvent.change(await screen.findByLabelText(/Why skip it/), {
      target: { value: "Treated already" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Skip it" }));
    await waitFor(() =>
      expect(skipMutate).toHaveBeenCalledWith({
        taskId: "t1",
        reason: "Treated already",
      }),
    );
  });

  it("Add reminder opens the notification sheet's New tab on this animal", () => {
    renderStrip([]);
    fireEvent.click(screen.getByRole("button", { name: "Add reminder" }));
    expect(openRemindMe).toHaveBeenCalledWith({ animal: { id: "c1", tagNumber: "A-12", name: "Lali" } });
  });

  it("Add reminder needs permission to create tasks and an animal that can take records", () => {
    allowTasks = false;
    renderStrip([]);
    expect(screen.queryByRole("button", { name: "Add reminder" })).not.toBeInTheDocument();
  });

  it("a task row's Remind me opens the composer anchored to that task", () => {
    renderStrip([event()]);
    fireEvent.click(screen.getByRole("button", { name: "Remind me" }));
    expect(openRemindMe).toHaveBeenCalledWith({
      anchor: { type: "TASK", id: "t1", label: expect.any(String) as string },
      animal: { id: "c1", tagNumber: "A-12", name: "Lali" },
    });
  });

  it("a health step row anchors to the health step; a derived row (pregnancy) gets no Remind me", () => {
    renderStrip([event({ kind: "HEALTH_STEP", labelKey: "cattle.upcoming.healthStep", ref: { type: "HEALTH_TASK", id: "h1" } })]);
    fireEvent.click(screen.getByRole("button", { name: "Remind me" }));
    expect(openRemindMe).toHaveBeenCalledWith(expect.objectContaining({ anchor: expect.objectContaining({ type: "HEALTH_STEP", id: "h1" }) as unknown }));
  });

  it("a derived row gets no Remind me", () => {
    renderStrip([event({ kind: "CALVING", labelKey: "cattle.upcoming.calving", ref: { type: "PREGNANCY", id: "p1" } })]);
    expect(screen.queryByRole("button", { name: "Remind me" })).not.toBeInTheDocument();
  });

  it("renders in Bangla", () => {
    renderStrip(
      [
        event({
          kind: "CALVING",
          ref: { type: "PREGNANCY", id: "p1" },
          labelKey: "cattle.upcoming.calving",
        }),
      ],
      { locale: "bn" },
    );
    expect(screen.getByRole("button", { name: "লিখুন" })).toBeInTheDocument();
  });

  const five = () => [1, 2, 3, 4, 5].map((n) => event({ labelParams: { title: `Task ${n}` }, ref: { type: "TASK", id: `t${n}` }, daysUntil: n }));

  it("lists every loaded card inline — no Show all click", () => {
    renderStrip(five());
    expect(screen.getByText("Task 5")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Show all/ })).not.toBeInTheDocument();
  });

  it("lists overdue first", () => {
    renderStrip([...five(), event({ labelParams: { title: "Late one" }, ref: { type: "TASK", id: "late" }, daysUntil: -4, urgency: "OVERDUE" })]);
    const titles = screen.getAllByText(/Task \d|Late one/).map((n) => n.textContent);
    expect(titles[0]).toBe("Late one");
  });

  it("starts with a page of 10 rows", () => {
    renderStrip(five());
    expect(useUpcomingEvents).toHaveBeenLastCalledWith("c1", true, 10);
  });

  it("shows a sentinel, not a +N footer, while more rows can still be loaded", () => {
    useUpcomingEvents.mockReturnValue({ isLoading: false, isError: false, isFetching: false, data: { events: five(), total: 9 }, refetch: vi.fn() });
    render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
        <NextUp cattleId="c1" canRecord onRecord={vi.fn()} />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByText("+4 more")).not.toBeInTheDocument();
  });
});
