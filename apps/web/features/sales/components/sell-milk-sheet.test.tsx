import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";

const mocks = vi.hoisted(() => ({
  buyer: { id: "b1", name: "Rahim Dairy", basePricePerLitre: 70, paymentTermsDays: 0 },
  mutateAsync: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));
vi.mock("@/features/buyers/hooks/use-buyers", () => ({
  useBuyersPagedList: () => ({ items: [mocks.buyer] }),
  useRecordDispatch: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}));
vi.mock("../hooks/use-sales", () => ({
  useMilkAvailability: () => ({ data: { totalAvailableL: 100, tanks: [] } }),
}));
vi.mock("@/features/buyers/components/buyer-picker", () => ({
  BuyerPicker: ({ onChange }: { onChange: (id: string, buyer: typeof mocks.buyer) => void }) => (
    <button type="button" onClick={() => onChange(mocks.buyer.id, mocks.buyer)}>
      pick-buyer
    </button>
  ),
}));

import { SellMilkSheet } from "./sell-milk-sheet";

function renderSheet() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
      <SellMilkSheet open onOpenChange={vi.fn()} />
    </NextIntlClientProvider>,
  );
}

describe("SellMilkSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.mutateAsync.mockResolvedValue({ amountReceived: 2800, calculatedAmount: 2800 });
  });

  it("sells paid-now in ONE call: amount defaults to the total and the method to Cash", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByRole("button", { name: "pick-buyer" }));
    await user.type(screen.getByLabelText("Litres sold"), "40");
    await user.click(screen.getByRole("button", { name: "Sell milk" }));

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    expect(mocks.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ buyerId: "b1", volumeDispatchedL: 40, amountReceived: 2800, paymentMethod: "CASH" }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });

  it("sends no payment fields for a credit sale", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByRole("button", { name: "pick-buyer" }));
    await user.type(screen.getByLabelText("Litres sold"), "40");
    await user.click(screen.getByRole("radio", { name: "On credit" }));
    await user.click(screen.getByRole("button", { name: "Sell milk" }));

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = mocks.mutateAsync.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.volumeDispatchedL).toBe(40);
    expect(payload).not.toHaveProperty("amountReceived");
    expect(payload).not.toHaveProperty("paymentMethod");
  });

  it("blocks selling more than the milk in stock", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByRole("button", { name: "pick-buyer" }));
    await user.type(screen.getByLabelText("Litres sold"), "150");

    expect(await screen.findByText("Only 100 L in stock")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Sell milk" }) as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("fills the litres with everything in stock", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByRole("button", { name: "Sell all 100 L" }));

    expect((screen.getByLabelText("Litres sold") as HTMLInputElement).value).toBe("100");
  });
});
