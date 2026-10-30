import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import bn from "@/i18n/messages/bn.json";
import type { FollowUpRule } from "../hooks/use-follow-up-rules";
import { changedRules, effective, FollowUpRulesView } from "./follow-up-rules-view";

// jsdom has no ResizeObserver; the Radix switch needs one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const rule = (over: Partial<FollowUpRule> = {}): FollowUpRule => ({
  ruleKey: "BREEDING_TO_PREG_CHECK", title: "Pregnancy check", trigger: "BREEDING", kind: "TASK",
  enabled: true, defaultOn: true, offsetDays: 35, defaultOffsetDays: 35, completesOn: ["PREG_CHECK"], ...over,
});

const useFollowUpRules = vi.fn();
const mutateAsync = vi.fn();
let canUpdate = true;
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/auth/permissions", () => ({ useCan: () => (permission: string) => (permission === "settings.update" ? canUpdate : true) }));
vi.mock("../hooks/use-follow-up-rules", () => ({
  useFollowUpRules: () => useFollowUpRules() as unknown,
  useUpdateFollowUpRules: () => ({ mutateAsync: (rules: unknown) => mutateAsync(rules) as Promise<unknown>, isPending: false }),
}));

function renderView(rules: FollowUpRule[], locale: "en" | "bn" = "en") {
  useFollowUpRules.mockReturnValue({ isLoading: false, isError: false, data: rules, refetch: vi.fn() });
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn} timeZone="Asia/Dhaka">
      <FollowUpRulesView />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  canUpdate = true;
  mutateAsync.mockResolvedValue({});
});

describe("changedRules", () => {
  it("lists only what changed, and an offset equal to the default goes back as null", () => {
    const rules = [rule(), rule({ ruleKey: "PREG_POSITIVE_TO_DRY_OFF", title: "Dry off", offsetDays: 60, defaultOffsetDays: 60 })];
    expect(changedRules(rules, {})).toEqual([]);
    expect(changedRules(rules, { BREEDING_TO_PREG_CHECK: { offsetDays: 45 } })).toEqual([{ ruleKey: "BREEDING_TO_PREG_CHECK", enabled: true, offsetDays: 45 }]);
    expect(changedRules(rules, { PREG_POSITIVE_TO_DRY_OFF: { enabled: false } })).toEqual([{ ruleKey: "PREG_POSITIVE_TO_DRY_OFF", enabled: false, offsetDays: null }]);
    expect(effective(rule({ offsetDays: 45 }), { offsetDays: null }).offset).toBe(35);
  });
});

describe("FollowUpRulesView", () => {
  it("lists each rule with its switch and offset", () => {
    renderView([rule(), rule({ ruleKey: "PREG_POSITIVE_TO_DRY_OFF", title: "Dry off", offsetDays: 60, defaultOffsetDays: 60 })]);
    expect(screen.getByRole("switch", { name: "Pregnancy check reminder" })).toBeChecked();
    expect(screen.getAllByRole("spinbutton")).toHaveLength(2);
    expect(screen.getByText("Default: 35 days")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("toggling a rule and changing a day offset saves one PUT with only the changes", async () => {
    renderView([rule(), rule({ ruleKey: "PREG_POSITIVE_TO_DRY_OFF", title: "Dry off", offsetDays: 60, defaultOffsetDays: 60 })]);
    fireEvent.click(screen.getByRole("switch", { name: "Dry-off reminder" }));
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith([
      { ruleKey: "BREEDING_TO_PREG_CHECK", enabled: true, offsetDays: 42 },
      { ruleKey: "PREG_POSITIVE_TO_DRY_OFF", enabled: false, offsetDays: null },
    ]);
  });

  it("reset to default puts the switch and offset back and saves them as defaults", async () => {
    renderView([rule({ enabled: false, offsetDays: 50 })]);
    fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));
    expect(screen.getByRole("switch")).toBeChecked();
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("35");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith([{ ruleKey: "BREEDING_TO_PREG_CHECK", enabled: true, offsetDays: null }]));
  });

  it("without settings.update the list is read-only: no editing, no Save", () => {
    canUpdate = false;
    renderView([rule()]);
    expect(screen.getByText(/Only managers can change/)).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeDisabled();
    expect(screen.getByRole("spinbutton")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });

  it("an unknown rule shows the server title", () => {
    renderView([rule({ ruleKey: "SOMETHING_NEW", title: "Hoof check", defaultOffsetDays: null, offsetDays: null })]);
    expect(screen.getByRole("switch", { name: "Hoof check" })).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("renders in Bangla", () => {
    renderView([rule()], "bn");
    expect(screen.getByRole("button", { name: "পরিবর্তন সংরক্ষণ" })).toBeInTheDocument();
  });
});
