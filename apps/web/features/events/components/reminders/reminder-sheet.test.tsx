import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import bn from "@/i18n/messages/bn.json";
import type { Task } from "@/features/tasks/types";
import { ReminderSheet } from "./reminder-sheet";

// jsdom has no ResizeObserver; Radix popovers need one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const createMutate = vi.fn();
const updateMutate = vi.fn();
const cancelMutate = vi.fn();

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/auth/use-session", () => ({ useSession: () => ({ data: { user: { id: "u1", name: "Demo Owner" } } }) }));
vi.mock("@/features/tasks/hooks/use-tasks", () => ({
  useTaskAssignees: () => ({ isLoading: false, data: [{ id: "u1", name: "Demo Owner", status: "active" }, { id: "u2", name: "Rina", status: "active" }] }),
}));
vi.mock("@/components/shared/cattle-picker", () => ({ CattleMultiPicker: () => <div data-testid="cattle-picker" /> }));
vi.mock("../../reminders/use-reminders", () => ({
  useCreateReminder: () => ({ mutateAsync: (dto: unknown) => createMutate(dto) as Promise<unknown>, isPending: false }),
  useUpdateReminder: () => ({ mutateAsync: (args: unknown) => updateMutate(args) as Promise<unknown>, isPending: false }),
  useCancelReminder: () => ({ mutateAsync: (args: unknown) => cancelMutate(args) as Promise<unknown>, isPending: false }),
  useAnchorEvents: () => ({ isLoading: false, isError: false, data: [{ id: "e1", type: "TREATMENT", eventAt: new Date(2026, 9, 26, 10).toISOString() }] }),
}));

const LALI = { id: "c1", tagNumber: "A-12", name: "Lali" };

function renderSheet(props: Partial<React.ComponentProps<typeof ReminderSheet>> = {}, locale: "en" | "bn" = "en") {
  const onOpenChange = vi.fn();
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn} timeZone="Asia/Dhaka">
      <ReminderSheet open onOpenChange={onOpenChange} {...props} />
    </NextIntlClientProvider>,
  );
  return onOpenChange;
}

const LINKED = {
  id: "t1",
  name: "Check hoof",
  details: null,
  kind: "REMINDER", category: "GENERAL",
  dueAt: new Date(2026, 10, 5, 8, 0).toISOString(),
  recurring: false,
  recurrenceType: null,
  recurrenceEndDate: null,
  sourceEventId: "e1",
  reminderOffsetDays: 10,
  relatedCattle: LALI,
  cattleTags: [],
  assignedToId: "u1",
  notifyRoleNames: [],
  recipientUserIds: [],
} as unknown as Task;

beforeEach(() => {
  vi.clearAllMocks();
  createMutate.mockResolvedValue({});
  updateMutate.mockResolvedValue({ ...LINKED });
  cancelMutate.mockResolvedValue({});
});

describe("ReminderSheet — create", () => {
  it("is titled for the animal and sends a dated reminder for me on that animal", async () => {
    const onOpenChange = renderSheet({ animal: LALI });
    expect(screen.getByRole("heading", { name: "New reminder · Lali" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Check left hind hoof" } });
    fireEvent.click(screen.getByRole("button", { name: "Save reminder" }));
    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    expect(createMutate.mock.calls[0][0]).toMatchObject({
      name: "Check left hind hoof",
      kind: "REMINDER", category: "GENERAL",
      recurring: false,
      assignedToId: "u1",
      relatedCattleId: "c1",
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("will not save without a title", async () => {
    renderSheet({ animal: LALI });
    fireEvent.click(screen.getByRole("button", { name: "Save reminder" }));
    expect(await screen.findByText("Give the reminder a title")).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("'After an event' asks for the event before it saves, and shows no date field", async () => {
    renderSheet({ animal: LALI });
    fireEvent.click(screen.getByRole("radio", { name: "After an event" }));
    expect(screen.queryByText("Date")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Recheck" } });
    fireEvent.click(screen.getByRole("button", { name: "Save reminder" }));
    expect(await screen.findByText("Pick the event")).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("'After an event' needs exactly one animal", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("radio", { name: "After an event" }));
    expect(screen.getAllByText("Pick one animal").length).toBeGreaterThan(0);
  });

  it("named people and roles are chosen from the active team and the three roles", async () => {
    renderSheet({ animal: LALI });
    fireEvent.click(screen.getByRole("radio", { name: "Named people" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Vet visit" } });
    fireEvent.click(screen.getByRole("button", { name: "Save reminder" }));
    expect(await screen.findByText("Pick at least one person")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Rina" }));
    fireEvent.click(screen.getByRole("button", { name: "Save reminder" }));
    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    expect(createMutate.mock.calls[0][0]).toMatchObject({ recipientUserIds: ["u2"] });
    expect((createMutate.mock.calls[0][0] as { assignedToId?: string }).assignedToId).toBeUndefined();
  });

  it("repeat every N days asks for the interval", async () => {
    renderSheet({ animal: LALI });
    fireEvent.click(screen.getByRole("radio", { name: "Every N days" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Weigh" } });
    fireEvent.change(screen.getByLabelText("Every how many days"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Save reminder" }));
    expect(await screen.findByText("Enter 1 to 365 days")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Every how many days"), { target: { value: "14" } });
    fireEvent.click(screen.getByRole("button", { name: "Save reminder" }));
    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    expect(createMutate.mock.calls[0][0]).toMatchObject({ recurring: true, recurrenceType: "EVERY_N_DAYS", recurrenceIntervalDays: 14 });
  });

  it("renders in Bangla", () => {
    renderSheet({ animal: LALI }, "bn");
    expect(screen.getByRole("heading", { name: "নতুন রিমাইন্ডার · Lali" })).toBeInTheDocument();
  });
});

describe("ReminderSheet — edit and cancel", () => {
  it("an event-linked reminder keeps following the event: saving a new offset sends offsetDays, not a date", async () => {
    const onSaved = vi.fn();
    renderSheet({ task: LINKED, onSaved });
    expect(screen.getByRole("heading", { name: "Edit reminder" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "On a date" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Days after"), { target: { value: "14" } });
    fireEvent.click(screen.getByRole("button", { name: "Save reminder" }));
    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    const args = updateMutate.mock.calls[0][0] as { id: string; dto: Record<string, unknown> };
    expect(args.id).toBe("t1");
    expect(args.dto.offsetDays).toBe(14);
    expect(args.dto.dueAt).toBeUndefined();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("the animals are shown but cannot be changed", () => {
    renderSheet({ task: LINKED });
    expect(screen.getByText(/A-12 — Lali/)).toBeInTheDocument();
    expect(screen.queryByTestId("cattle-picker")).not.toBeInTheDocument();
    expect(screen.getByText(/Animals cannot be changed/)).toBeInTheDocument();
  });

  it("cancelling a reminder asks first, then cancels the task", async () => {
    const onOpenChange = renderSheet({ task: LINKED });
    fireEvent.click(screen.getByRole("button", { name: "Cancel this reminder" }));
    expect(cancelMutate).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Cancel reminder" }));
    await waitFor(() => expect(cancelMutate).toHaveBeenCalledWith({ id: "t1" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("Keep it leaves the reminder alone", async () => {
    renderSheet({ task: LINKED });
    fireEvent.click(screen.getByRole("button", { name: "Cancel this reminder" }));
    // The confirm dialog's close icon carries the same name as its cancel button.
    const keep = await screen.findAllByRole("button", { name: "Keep it" });
    fireEvent.click(keep[keep.length - 1]);
    expect(cancelMutate).not.toHaveBeenCalled();
  });
});
