import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import { ApiError } from "@/lib/api/errors";
import type { ProtocolRound } from "../types";
import { RoundAnimalsDialog } from "./round-animals-dialog";

const h = vi.hoisted(() => ({
  add: vi.fn(),
  isPending: false,
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: (message: string) => h.toastError(message), success: vi.fn() } }));
vi.mock("../hooks/use-health", () => ({
  useAddRoundAnimals: () => ({ mutateAsync: h.add, isPending: h.isPending }),
}));
vi.mock("./animal-multi-picker", () => ({
  AnimalMultiPicker: ({ selected, onChange }: { selected: Map<string, { id: string; tagNumber: string; name: string | null }>; onChange: (next: Map<string, unknown>) => void }) => {
    const pick = (id: string, name: string) => () => onChange(new Map(selected).set(id, { id, tagNumber: `TAG-${name}`, name }));
    return (
      <div>
        <span data-testid="picked">{selected.size}</span>
        <button type="button" onClick={pick("a1", "Anna")}>
          pick-Anna
        </button>
        <button type="button" onClick={pick("z1", "Zoya")}>
          pick-Zoya
        </button>
      </div>
    );
  },
}));

const round = {
  roundKey: "app:r1",
  healthPlan: { id: "p1", name: "FMD vaccine", category: "VACCINATION", deletedAt: null },
  kind: "PREVENTION",
  startDate: "2026-10-02",
  animalCount: 12,
  stepsTotal: 24,
  stepsDone: 9,
  stepsSkipped: 0,
  stepsOverdue: 0,
  stepsDueToday: 0,
  nextDueDate: null,
  status: "RUNNING",
} as unknown as ProtocolRound;

function renderDialog(onOpenChange = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
      <RoundAnimalsDialog round={round} open onOpenChange={onOpenChange} />
    </NextIntlClientProvider>,
  );
  return { onOpenChange };
}

describe("RoundAnimalsDialog (RFE-148)", () => {
  beforeEach(() => {
    h.add.mockReset();
    h.isPending = false;
    h.toastError.mockReset();
  });

  it("says which round the animals will join, and what happens to steps already past", () => {
    renderDialog();
    expect(screen.getByText("Add animals to this round")).toBeTruthy();
    expect(screen.getByText("They join this round of FMD vaccine, started Oct 2. Steps that would already be past are due today.")).toBeTruthy();
  });

  it("will not submit with nobody picked, and says why", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Add animals" }));
    expect(await screen.findByText("Pick at least one animal.")).toBeTruthy();
    expect(h.add).not.toHaveBeenCalled();
  });

  it("the submit button counts who is picked", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "pick-Anna" }));
    fireEvent.click(screen.getByRole("button", { name: "pick-Zoya" }));
    expect(screen.getByRole("button", { name: "Add 2 animals" })).toBeTruthy();
  });

  it("sends the round and the picked animals, then says how many joined", async () => {
    h.add.mockResolvedValue({
      roundKey: "app:r1",
      addedCount: 2,
      skippedCount: 0,
      results: [
        { cattleId: "a1", status: "applied", planEnrollmentId: "e1" },
        { cattleId: "z1", status: "applied", planEnrollmentId: "e2" },
      ],
    });
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "pick-Anna" }));
    fireEvent.click(screen.getByRole("button", { name: "pick-Zoya" }));
    fireEvent.click(screen.getByRole("button", { name: "Add 2 animals" }));
    expect(await screen.findByText("2 animals added to the round")).toBeTruthy();
    expect(h.add).toHaveBeenCalledWith({ roundKey: "app:r1", cattleIds: ["a1", "z1"] });
    expect(screen.queryByText(/skipped/)).toBeNull();
  });

  it("lists, by name, the animals that were skipped because they are already on the protocol", async () => {
    h.add.mockResolvedValue({
      roundKey: "app:r1",
      addedCount: 1,
      skippedCount: 1,
      results: [
        { cattleId: "a1", status: "applied", planEnrollmentId: "e1" },
        { cattleId: "z1", status: "skipped", reason: "Animal already has an active enrollment for this protocol" },
      ],
    });
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "pick-Anna" }));
    fireEvent.click(screen.getByRole("button", { name: "pick-Zoya" }));
    fireEvent.click(screen.getByRole("button", { name: "Add 2 animals" }));
    expect(await screen.findByText("1 animal added to the round")).toBeTruthy();
    expect(screen.getByText("1 animal was skipped — it is already on this protocol")).toBeTruthy();
    expect(screen.getByText("Zoya")).toBeTruthy();
  });

  it("a failure shows the server's message and keeps the picks", async () => {
    h.add.mockRejectedValue(new ApiError("BAD_REQUEST", "This protocol was deleted, so animals cannot be added to its rounds", 400));
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "pick-Anna" }));
    fireEvent.click(screen.getByRole("button", { name: "Add 1 animal" }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("This protocol was deleted, so animals cannot be added to its rounds"));
    expect(screen.getByTestId("picked").textContent).toBe("1");
  });

  it("Done closes the dialog", async () => {
    h.add.mockResolvedValue({ roundKey: "app:r1", addedCount: 1, skippedCount: 0, results: [{ cattleId: "a1", status: "applied", planEnrollmentId: "e1" }] });
    const { onOpenChange } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "pick-Anna" }));
    fireEvent.click(screen.getByRole("button", { name: "Add 1 animal" }));
    fireEvent.click(await screen.findByRole("button", { name: "Done" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
