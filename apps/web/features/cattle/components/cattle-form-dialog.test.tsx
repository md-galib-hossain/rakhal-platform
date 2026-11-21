import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { LocaleProvider } from "@rakhal/ui/lib/locale";
import { LabelsProvider } from "@rakhal/ui/lib/labels";
import { buildSharedLabels } from "@/test/shared-ui-providers";
import en from "@/i18n/messages/en.json";
import { CattleFormDialog } from "./cattle-form-dialog";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const createMutateAsync = vi.fn();
const updateMutateAsync = vi.fn();
const noop = { mutateAsync: vi.fn(), isPending: false };
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/shared/cattle-picker", () => ({ CattlePicker: () => <div>picker</div> }));
vi.mock("../hooks/use-cattle", () => ({
  useCreateCattle: () => ({ mutateAsync: createMutateAsync, isPending: false }),
  useUpdateCattle: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
  useBreeds: () => ({ data: { items: [] } }),
  useSheds: () => ({ data: { items: [] } }),
  useAnimalGroups: () => ({ data: { items: [] } }),
  useCreateBreed: () => noop,
  useCreateShedInline: () => noop,
  useCreateAnimalGroup: () => noop,
  useSetCattlePhoto: () => noop,
  useRemoveCattlePhoto: () => noop,
}));

const onOpenChange = vi.fn();

function renderDialog(open = true) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <LocaleProvider locale="en">
        <LabelsProvider labels={buildSharedLabels(en)}>
          <CattleFormDialog open={open} onOpenChange={onOpenChange} />
        </LabelsProvider>
      </LocaleProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  createMutateAsync.mockResolvedValue({ id: "new-cow-1" });
});

describe("CattleFormDialog (RFE-022, RFE-162)", () => {
  it("renders basic info step initially", () => {
    renderDialog();
    expect(screen.getByText("Add New Animal")).toBeInTheDocument();
    expect(screen.getByLabelText("ID")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next: her history" })).toBeInTheDocument();
  });

  it("advances to history step when Next is clicked with valid basic info", async () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("ID"), { target: { value: "TAG-999" } });
    const nextBtn = screen.getByRole("button", { name: "Next: her history" });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getAllByText("Her history (optional)").length).toBeGreaterThanOrEqual(1);
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("does not advance when Next is clicked with empty Tag ID", async () => {
    renderDialog();
    const nextBtn = screen.getByRole("button", { name: "Next: her history" });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.queryByText("Her history (optional)")).not.toBeInTheDocument();
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
