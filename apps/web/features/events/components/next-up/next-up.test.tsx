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
const useReminderTask = vi.fn();
let allowTasks = true;

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/auth/permissions", () => ({ useCan: () => () => allowTasks }));
vi.mock("@/features/cattle/hooks/use-cattle", () => ({
  useUpcomingEvents: (id: string, enabled: boolean) => useUpcomingEvents(id, enabled) as unknown,
}));
vi.mock("../../reminders/use-reminders", () => ({
  useReminderTask: (id: string) => useReminderTask(id) as unknown,
}));
// The reminder form itself is covered in `reminder-sheet.test.tsx`; here only that the right entry opens it.
vi.mock("../reminders/reminder-sheet", () => ({
  ReminderSheet: ({ open, task, animal }: { open: boolean; task?: { name: string }; animal?: { tagNumber: string } }) =>
    open ? <div role="dialog">{task ? `editing ${task.name}` : `new reminder for ${animal?.tagNumber ?? "nobody"}`}</div> : null,
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
      <NextUp cattleId="c1" animal={{ id: "c1", tagNumber: "A-12", name: "Lali" }} canRecord={opts.canRecord ?? true} onRecord={onRecord} />
    </NextIntlClientProvider>,
  );
  return onRecord;
}

beforeEach(() => {
  vi.clearAllMocks();
  allowTasks = true;
  useReminderTask.mockReturnValue({ data: undefined });
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
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Add reminder"]);
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

  it("Add reminder opens the reminder form on this animal", () => {
    renderStrip([]);
    fireEvent.click(screen.getByRole("button", { name: "Add reminder" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("new reminder for A-12");
  });

  it("Add reminder needs permission to create tasks and an animal that can take records", () => {
    allowTasks = false;
    renderStrip([]);
    expect(screen.queryByRole("button", { name: "Add reminder" })).not.toBeInTheDocument();
  });

  it("only a custom reminder gets Edit, and Edit opens the form on that reminder", () => {
    renderStrip([event()]);
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();

    useReminderTask.mockReturnValue({ data: { id: "t1", name: "Check hoof", category: "REMINDER" } });
    renderStrip([event()]);
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    expect(screen.getByRole("dialog")).toHaveTextContent("editing Check hoof");
  });

  it("renders in Bangla", () => {
    renderStrip([event({ kind: "CALVING", ref: { type: "PREGNANCY", id: "p1" }, labelKey: "cattle.upcoming.calving" })], { locale: "bn" });
    expect(screen.getByRole("button", { name: "লিখুন" })).toBeInTheDocument();
  });
});
