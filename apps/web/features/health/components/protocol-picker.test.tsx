import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import { ApiError } from "@/lib/api/errors";
import { ProtocolPicker } from "./protocol-picker";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: h.toastSuccess, error: h.toastError } }));
vi.mock("@/components/ui/date-picker", () => ({ DatePicker: () => <div /> }));
vi.mock("../hooks/use-health", () => ({
  useHealthPlans: () => ({
    isLoading: false,
    data: {
      items: [
        {
          id: "p1",
          name: "Mastitis 5-day",
          condition: "MASTITIS",
          totalActionSteps: 5,
          cycleLengthDays: 5,
          steps: [],
          stats: { kind: "TREATMENT", recoveryRate: 80 },
        },
      ],
    },
  }),
  useApplyPlanToCase: () => ({ mutateAsync: h.mutateAsync, isPending: false }),
}));

function renderPicker(props: { caseId?: string; caseIds?: string[]; onApplied?: (name: string) => void }) {
  const onApplied = props.onApplied ?? vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
      <ProtocolPicker caseId={props.caseId} caseIds={props.caseIds} condition="MASTITIS" onApplied={onApplied} />
    </NextIntlClientProvider>,
  );
  return { onApplied };
}

const start = async () => {
  fireEvent.click(screen.getByRole("radio", { name: /Mastitis 5-day/ }));
  fireEvent.click(screen.getByRole("button", { name: "Start protocol" }));
};

describe("ProtocolPicker (single case and several, RFE-139)", () => {
  beforeEach(() => {
    h.mutateAsync.mockReset();
    h.toastSuccess.mockReset();
    h.toastError.mockReset();
  });

  it("a single case is applied once, with the single-case message", async () => {
    h.mutateAsync.mockResolvedValue({});
    const { onApplied } = renderPicker({ caseId: "c1" });
    await start();
    await waitFor(() => expect(onApplied).toHaveBeenCalledWith("Mastitis 5-day"));
    expect(h.mutateAsync).toHaveBeenCalledTimes(1);
    expect(h.mutateAsync.mock.calls[0][0]).toMatchObject({ caseId: "c1", dto: { healthPlanId: "p1" } });
    expect(h.toastSuccess).toHaveBeenCalledWith("Protocol started.");
  });

  it("several cases get the same protocol, one call each", async () => {
    h.mutateAsync.mockResolvedValue({});
    const { onApplied } = renderPicker({ caseIds: ["c1", "c2", "c3"] });
    await start();
    await waitFor(() => expect(onApplied).toHaveBeenCalled());
    expect(h.mutateAsync.mock.calls.map((c) => c[0].caseId)).toEqual(["c1", "c2", "c3"]);
    expect(h.toastSuccess).toHaveBeenCalledWith("3 cases started on the protocol.");
  });

  it("a failure part-way says how many made it, and still counts as applied", async () => {
    h.mutateAsync.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({});
    const { onApplied } = renderPicker({ caseIds: ["c1", "c2", "c3"] });
    await start();
    await waitFor(() => expect(h.toastError).toHaveBeenCalled());
    expect(h.mutateAsync).toHaveBeenCalledTimes(3); // carries on past the failure
    expect(h.toastError).toHaveBeenCalledWith("Started 2 of 3 — the rest could not be started.");
    expect(onApplied).toHaveBeenCalled();
  });

  it("when every case fails it shows the server's message and does not report success", async () => {
    h.mutateAsync.mockRejectedValue(new ApiError("BAD_REQUEST", "Protocol has no steps", 400));
    const { onApplied } = renderPicker({ caseIds: ["c1", "c2"] });
    await start();
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Protocol has no steps"));
    expect(onApplied).not.toHaveBeenCalled();
    expect(h.toastSuccess).not.toHaveBeenCalled();
  });

  it("marks the protocol tagged with the condition as suggested, with its recovery rate", () => {
    renderPicker({ caseId: "c1" });
    expect(screen.getByText("Suggested")).toBeTruthy();
    expect(screen.getByText(/80% recovered/)).toBeTruthy();
  });
});
