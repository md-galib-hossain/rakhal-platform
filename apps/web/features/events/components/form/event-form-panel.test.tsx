import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import bn from "@/i18n/messages/bn.json";
import { ApiError } from "@/lib/api/errors";
import type { CattleDetail } from "@/features/cattle/types";
import type { EventKey } from "../../types";
import { EventUnavailableError } from "../../hooks/use-record-event";
import { EventFormPanel } from "./event-form-panel";

// jsdom has no ResizeObserver; Radix checkbox / popover need one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mutateAsync = vi.fn();
const dry = vi.hoisted(() => ({ data: undefined as unknown }));
vi.mock("../../hooks/use-animal-timeline", () => ({
  useAnimalTimeline: () => ({ items: [], isLoading: false, isError: false }),
}));
vi.mock("@/features/inventory/components/semen-batch-picker", () => ({ SemenBatchPicker: () => <div data-testid="semen-picker" /> }));
vi.mock("@/features/settings/hooks/use-team", () => ({ useTeam: () => ({ data: { members: [{ name: "Rahim" }] } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const FMD = vi.hoisted(() => ({ id: "m1", name: "FMD", currentStock: 10, stockStatus: "adequate", expiryStatus: "ok", unit: { symbol: "ml" } }));
vi.mock("@/features/inventory/hooks/use-inventory", () => ({
  useMedicineInfiniteList: () => ({ items: [FMD], isLoading: false, hasNextPage: false, isFetchingNextPage: false, isNextPageError: false, fetchNextPage: vi.fn() }),
  useMedicineDetail: (id?: string) => ({ data: id === "m1" ? FMD : undefined }),
}));
vi.mock("../../hooks/use-record-event", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks/use-record-event")>()),
  useEventDryRun: () => ({ data: dry.data, error: null }),
  useRecordEvent: () => ({ mutateAsync: (args: unknown) => mutateAsync(args) as Promise<unknown>, isPending: false }),
  useVoidEvent: () => ({ mutateAsync: vi.fn() }),
}));

const cow = (over: Partial<CattleDetail> = {}) =>
  ({
    id: "c1", name: "Lali", tagNumber: "T-1", gender: "FEMALE", animalCategory: "COW", herdStatus: "ACTIVE",
    reproductiveStatus: "OPEN", productionStatus: "MILKING", dim: 90, ...over,
  }) as CattleDetail;

function renderForm(eventKey: EventKey, animal = cow(), locale: "en" | "bn" = "en") {
  const onDone = vi.fn();
  const onBack = vi.fn();
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn} timeZone="Asia/Dhaka">
      <EventFormPanel eventKey={eventKey} cattle={animal} onBack={onBack} onDone={onDone} />
    </NextIntlClientProvider>,
  );
  return { onDone, onBack };
}

beforeEach(() => {
  vi.clearAllMocks();
  dry.data = undefined;
  mutateAsync.mockResolvedValue({ via: "route", body: { ref: "preg:1" } });
});

describe("EventFormPanel", () => {
  it("a preg check needs only a result: no AI is asked for, and it saves", async () => {
    const { onDone } = renderForm("PREG_CHECK");
    expect(screen.queryByText(/AI/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Required")).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: "Pregnant" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const { request, idempotencyKey } = mutateAsync.mock.calls[0][0] as { request: Record<string, unknown>; idempotencyKey: string };
    expect(request).toMatchObject({ type: "PREG_CHECK", provenance: "RECORDED", payload: { result: "PREGNANT", diagnosisMethod: "PALPATION" } });
    expect(idempotencyKey).toBeTruthy();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it("heat on a pregnant cow shows an amber warning and still saves", async () => {
    renderForm("HEAT", cow({ reproductiveStatus: "PREGNANT" }));
    expect(screen.getByText(/Unusual for this animal: Pregnant\./)).toBeInTheDocument();
    expect(screen.getByText(/You can still save\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
  });

  it("keeps More details closed until asked, and lists them when opened", () => {
    renderForm("HEAT");
    expect(screen.queryByText("Standing heat")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /More details/ }));
    expect(screen.getByText("Standing heat")).toBeInTheDocument();
  });

  it("shows What happens next for a service, with the reminder ticked", () => {
    renderForm("SERVICE");
    expect(screen.getByText("What happens next")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Pregnancy check reminder/ })).toBeChecked();
  });

  it("Save & record another keeps the form open and uses a fresh idempotency key", async () => {
    const { onDone } = renderForm("WEIGHT");
    fireEvent.change(screen.getByLabelText(/Weight/), { target: { value: "412" } });
    fireEvent.click(screen.getByRole("button", { name: "Save & record another" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(onDone).not.toHaveBeenCalled();
    expect((screen.getByLabelText(/Weight/) as HTMLInputElement).value).toBe("");
    fireEvent.change(screen.getByLabelText(/Weight/), { target: { value: "420" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    const keys = mutateAsync.mock.calls.map((call) => (call[0] as { idempotencyKey: string }).idempotencyKey);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("rejects an impossible weight without calling the server", async () => {
    renderForm("WEIGHT");
    fireEvent.change(screen.getByLabelText(/Weight/), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Check this number")).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("when the event service is missing, replaces the form with a clear message and a way back", async () => {
    mutateAsync.mockRejectedValueOnce(new EventUnavailableError());
    const { onBack } = renderForm("NOTE");
    fireEvent.change(screen.getByRole("textbox", { name: /Note/ }), { target: { value: "Check left hoof" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Not available here yet")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Back" })[0]);
    expect(onBack).toHaveBeenCalled();
  });

  it("closes at once when nothing was typed, and asks before throwing typed values away", () => {
    const first = renderForm("WEIGHT");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(first.onDone).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Discard what you entered?")).not.toBeInTheDocument();
  });

  it("Esc with typed values shows the discard question; Keep editing stays, Discard closes", () => {
    const { onDone } = renderForm("WEIGHT");
    fireEvent.change(screen.getByLabelText(/Weight/), { target: { value: "412" } });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByText("Discard what you entered?")).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByText("Discard what you entered?")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("renders the Bangla labels", () => {
    renderForm("PREG_CHECK", cow(), "bn");
    expect(screen.getByRole("radio", { name: "গর্ভবতী" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "সংরক্ষণ" })).toBeInTheDocument();
  });
});

describe("health forms in the panel", () => {
  // cmdk (the medicine picker's list) scrolls the active option into view; jsdom has no layout.
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  /** The four fields a live health entry needs (server validation): medicine from stock, dose, unit, route. */
  function fillDose(opts: { nextDoseDays?: string } = {}) {
    fireEvent.click(screen.getByRole("combobox", { name: /Medicine \(from stock\)/ }));
    fireEvent.click(screen.getByRole("option", { name: /FMD/ }));
    fireEvent.change(screen.getByLabelText(/^Dose/), { target: { value: "2" } });
    // The unit is taken from the chosen medicine and locked.
    expect(screen.getByLabelText(/^Unit/)).toHaveValue("ml");
    expect(screen.getByLabelText(/^Unit/)).toHaveAttribute("readonly");
    fireEvent.change(screen.getByLabelText(/^Route/), { target: { value: "IM" } });
    if (opts.nextDoseDays) {
      fireEvent.click(screen.getByRole("button", { name: /More details/ }));
      fireEvent.change(screen.getByLabelText(/Next dose in/), { target: { value: opts.nextDoseDays } });
    }
  }

  it("vaccination: marks the four required fields, asks for them, then saves with the next-dose reminder", async () => {
    const { onDone } = renderForm("VACCINATION");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findAllByText("Required")).toHaveLength(4);
    expect(mutateAsync).not.toHaveBeenCalled();

    fillDose({ nextDoseDays: "180" });
    expect(await screen.findByRole("checkbox", { name: /Next dose reminder/ })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const { request } = mutateAsync.mock.calls[0][0] as { request: Record<string, unknown> };
    expect(request).toMatchObject({ type: "VACCINATION", payload: { medicineId: "m1", doseAmount: 2, doseUnit: "ml", route: "IM", nextDoseDays: 180 } });
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it("deworming: saves once the required fields are filled", async () => {
    renderForm("DEWORMING");
    fillDose();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect((mutateAsync.mock.calls[0][0] as { request: { type: string } }).request.type).toBe("DEWORMING");
  });

  it("illness: needs a condition, then saves it with the default severity", async () => {
    renderForm("ILLNESS");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Required")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Condition/), { target: { value: "MASTITIS" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect((mutateAsync.mock.calls[0][0] as { request: Record<string, unknown> }).request).toMatchObject({
      type: "ILLNESS",
      payload: { condition: "MASTITIS", severity: "MEDIUM" },
    });
  });

  it("treatment: needs the medicine, dose, unit and route, then saves", async () => {
    renderForm("TREATMENT");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findAllByText("Required")).toHaveLength(4);
    fillDose();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect((mutateAsync.mock.calls[0][0] as { request: Record<string, unknown> }).request).toMatchObject({
      type: "TREATMENT",
      payload: { medicineId: "m1", doseAmount: 2, doseUnit: "ml", route: "IM" },
    });
  });

  const newCaseDryRun = { source: "route", findings: [{ code: "TREATMENT_NEW_CASE", severity: "INFO" }], followUps: [] };

  it("treatment with no open case: asks what it is for, blocks until set, and sends the condition", async () => {
    dry.data = newCaseDryRun;
    renderForm("TREATMENT");
    const condition = await screen.findByLabelText(/Condition/);
    fillDose();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Required")).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();

    fireEvent.change(condition, { target: { value: "MASTITIS" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect((mutateAsync.mock.calls[0][0] as { request: { payload: Record<string, unknown> } }).request.payload).toMatchObject({ condition: "MASTITIS", medicineId: "m1" });
  });

  it("treatment with an open case: no Condition field, and none is sent", async () => {
    dry.data = { source: "route", findings: [{ code: "OPEN_CASE_EXISTS", severity: "INFO" }], followUps: [] };
    renderForm("TREATMENT");
    expect(screen.queryByLabelText(/Condition/)).not.toBeInTheDocument();
    fillDose();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect((mutateAsync.mock.calls[0][0] as { request: { payload: Record<string, unknown> } }).request.payload).not.toHaveProperty("condition");
  });

  it("a server CONDITION_REQUIRED shows the Condition field with its error", async () => {
    mutateAsync.mockRejectedValueOnce(new ApiError("VALIDATION_ERROR", "condition required", 400, undefined, { eventCode: "CONDITION_REQUIRED", field: "condition" }));
    renderForm("TREATMENT");
    fillDose();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByLabelText(/Condition/)).toBeInTheDocument();
    expect(await screen.findByText("Required")).toBeInTheDocument();
  });

  it("while the server has no handler, shows a clear message and a Healthcare link instead of a dead form", async () => {
    mutateAsync.mockRejectedValueOnce(new ApiError("VALIDATION_ERROR", "cannot be recorded through this API yet", 422, undefined, { eventCode: "EVENT_TYPE_NOT_SUPPORTED" }));
    renderForm("TREATMENT");
    fillDose();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Not available here yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Healthcare" })).toHaveAttribute("href", "/healthcare");
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });
});
