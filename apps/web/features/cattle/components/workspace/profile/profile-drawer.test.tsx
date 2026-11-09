import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import type { CattleDetail } from "../../../types";
import { ProfileDrawer } from "./profile-drawer";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mutateAsync = vi.fn();
const noop = { mutateAsync: vi.fn(), isPending: false };
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/shared/cattle-picker", () => ({ CattlePicker: () => <div>picker</div> }));
vi.mock("../../../hooks/use-cattle", () => ({
  useUpdateCattle: () => ({ mutateAsync, isPending: false }),
  useBreeds: () => ({ data: { items: [] } }),
  useSheds: () => ({ data: { items: [] } }),
  useAnimalGroups: () => ({ data: { items: [] } }),
  useCreateBreed: () => noop,
  useCreateShedInline: () => noop,
  useCreateAnimalGroup: () => noop,
  useSetCattlePhoto: () => noop,
  useRemoveCattlePhoto: () => noop,
}));

const cow = {
  id: "c1",
  name: "Kajol",
  tagNumber: "T-1",
  gender: "FEMALE",
  dateOfBirth: null,
  lastWeightKg: 410,
  color: "",
  notes: "",
  profile_photo: null,
} as unknown as CattleDetail;
const onClose = vi.fn();

function renderDrawer() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ProfileDrawer cattle={cow} onClose={onClose} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mutateAsync.mockResolvedValue({ id: "c1" });
});

describe("ProfileDrawer (RFE-181)", () => {
  it("shows the three sections and no weight input", () => {
    renderDrawer();
    expect(screen.getByRole("heading", { name: "Identity" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Origin & family" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Physical" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/weight \(kg\)/i)).toBeNull();
  });

  it("saves without resending weight, then closes", async () => {
    renderDrawer();
    fireEvent.change(screen.getByLabelText("Cow Name"), { target: { value: "Kajol 2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const dto = mutateAsync.mock.calls[0][0].dto;
    expect(mutateAsync.mock.calls[0][0].id).toBe("c1");
    expect(dto.name).toBe("Kajol 2");
    expect(dto.weightKg).toBeUndefined();
  });

  it("blocks save and shows an inline error when the tag is empty", async () => {
    renderDrawer();
    fireEvent.change(screen.getByLabelText("ID"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Tag ID is required.")).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("closes straight away when nothing changed", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("asks before discarding typed changes", async () => {
    renderDrawer();
    fireEvent.change(screen.getByLabelText("Cow Name"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Discard your changes?")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
