import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import type { CattleDetail } from "@/features/cattle/types";
import { normaliseDryRun } from "../../api";
import { EventFormPanel } from "./event-form-panel";

// jsdom has no ResizeObserver; Radix checkbox / popover need one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mutateAsync = vi.fn();
let dryData: unknown;

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../hooks/use-record-event", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks/use-record-event")>()),
  useEventDryRun: () => ({ data: dryData, error: null }),
  useRecordEvent: () => ({ mutateAsync: (args: unknown) => mutateAsync(args) as Promise<unknown>, isPending: false }),
  useVoidEvent: () => ({ mutateAsync: vi.fn() }),
}));

const cow = { id: "c1", name: "Lali", tagNumber: "T-1", gender: "FEMALE", animalCategory: "COW", herdStatus: "ACTIVE", reproductiveStatus: "OPEN", productionStatus: "MILKING", dim: 90 } as CattleDetail;

function renderForm() {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
      <EventFormPanel eventKey="SERVICE" cattle={cow} onBack={vi.fn()} onDone={vi.fn()} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mutateAsync.mockResolvedValue({ via: "route", body: { ref: "e1" } });
  dryData = {
    source: "route",
    findings: [],
    followUps: [
      { key: "PREG_CHECK_AFTER_BREEDING", labelKey: "pregCheck", dueDate: "2099-01-01", pastDue: false, defaultOn: true },
      { key: "CUSTOM_RULE", labelKey: "generic", title: "Hoof check", dueDate: null, pastDue: false, defaultOn: false },
    ],
  };
});

describe("normaliseDryRun (server follow-up preview)", () => {
  it("reads ruleKey, title, dueDate and defaultOn", () => {
    const { followUps } = normaliseDryRun({ findings: [], followUpsPreview: [{ ruleKey: "PREG_CHECK_AFTER_BREEDING", title: "Preg check", dueDate: "2026-12-04T00:00:00.000Z", defaultOn: false }] }, "2026-10-30");
    expect(followUps).toEqual([{ key: "PREG_CHECK_AFTER_BREEDING", labelKey: "pregCheck", dueDate: "2026-12-04", pastDue: false, title: "Preg check", defaultOn: false }]);
  });
  it("still understands the older rule-key-only preview", () => {
    expect(normaliseDryRun({ followUpsPreview: [{ ruleKey: "PREG_CHECK_AFTER_BREEDING" }] }, "2026-10-30").followUps[0]).toMatchObject({ key: "PREG_CHECK_AFTER_BREEDING", dueDate: null });
  });
});

describe("What happens next toggles", () => {
  it("uses the server's default switches and its own title for an unknown rule", () => {
    renderForm();
    expect(screen.getByRole("checkbox", { name: /Pregnancy check reminder/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Hoof check/ })).not.toBeChecked();
  });

  it("saving with the defaults sends no followUps", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect((mutateAsync.mock.calls[0][0] as { request: Record<string, unknown> }).request.followUps).toBeUndefined();
  });

  it("switching one off sends every switch as followUps[{ruleKey, enabled}]", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("checkbox", { name: /Pregnancy check reminder/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect((mutateAsync.mock.calls[0][0] as { request: { followUps: unknown } }).request.followUps).toEqual([
      { ruleKey: "PREG_CHECK_AFTER_BREEDING", enabled: false },
      { ruleKey: "CUSTOM_RULE", enabled: false },
    ]);
  });

  it("a client-computed preview never sends followUps (its rule keys are not the server's)", async () => {
    dryData = undefined;
    renderForm();
    fireEvent.click(screen.getByRole("checkbox", { name: /Pregnancy check reminder/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect((mutateAsync.mock.calls[0][0] as { request: Record<string, unknown> }).request.followUps).toBeUndefined();
  });
});
