import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import type { CattleProtocolRun } from "../types";
import { CattleProtocolsSection } from "./cattle-protocols-section";

const h = vi.hoisted(() => ({
  items: [] as unknown[],
  isLoading: false,
  isError: false,
  canUpdate: true,
  skip: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("../hooks/use-health", () => ({
  useCattleProtocols: () => ({ data: { items: h.items }, isLoading: h.isLoading, isError: h.isError, refetch: vi.fn() }),
  useSkipTask: () => ({ mutateAsync: h.skip }),
  useStopCattleProtocol: () => ({ mutateAsync: h.stop }),
}));
vi.mock("@/lib/auth/permissions", () => ({
  Can: ({ children }: { children: React.ReactNode }) => (h.canUpdate ? <>{children}</> : null),
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const run = (over: Partial<CattleProtocolRun>): CattleProtocolRun => ({
  runType: "ENROLLMENT",
  id: "e1",
  healthCaseId: null,
  planEnrollmentId: "e1",
  caseCode: null,
  healthPlan: { id: "p1", name: "FMD vaccine", category: "VACCINATION" },
  startDate: "2026-09-30T00:00:00.000Z",
  currentStep: 1,
  totalSteps: 3,
  progressPercentage: 33,
  nextStep: { id: "t1", title: "Booster", dueDateTime: "2026-10-05T00:00:00.000Z", status: "PENDING" },
  ...over,
});

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
        <CattleProtocolsSection cattleId="c1" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

/** The confirm sheet's button carries the same label as the row's button; the sheet's is rendered last. */
const lastButton = (name: string) => screen.getAllByRole("button", { name }).at(-1)!;

describe("CattleProtocolsSection — every protocol on one animal", () => {
  beforeEach(() => {
    h.items = [];
    h.isLoading = false;
    h.isError = false;
    h.canUpdate = true;
    h.skip.mockReset().mockResolvedValue({});
    h.stop.mockReset().mockResolvedValue({});
  });

  it("says so when the animal is on nothing", () => {
    renderSection();
    expect(screen.getByText("This animal is not on any protocol.")).toBeTruthy();
  });

  it("lists a preventive round and a treatment protocol, with kind, progress and next step", () => {
    h.items = [
      run({}),
      run({
        runType: "CASE",
        id: "k1",
        healthCaseId: "k1",
        planEnrollmentId: null,
        caseCode: "HC-9",
        healthPlan: { id: "p2", name: "Mastitis 5-day", category: "TREATMENT" },
        nextStep: { id: "t2", title: "Antibiotic", dueDateTime: "2026-10-01T00:00:00.000Z", status: "OVERDUE" },
      }),
    ];
    renderSection();
    expect(screen.getByText("FMD vaccine")).toBeTruthy();
    expect(screen.getByText("Mastitis 5-day")).toBeTruthy();
    expect(screen.getByText("Treatment")).toBeTruthy();
    expect(screen.getByText("Prevention")).toBeTruthy();
    expect(screen.getByText("Booster")).toBeTruthy();
    expect(screen.getByText("Overdue")).toBeTruthy();
    expect(screen.getByText("HC-9")).toBeTruthy();
  });

  it("links to the Protocols tab for rescheduling and recording", () => {
    renderSection();
    expect(screen.getByRole("link", { name: /Open protocols/ }).getAttribute("href")).toBe("/healthcare?healthTab=protocols");
  });

  it("skipping the next step asks first, then skips that step", async () => {
    h.items = [run({})];
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Skip next step" }));
    expect(await screen.findByText("Skip this step?")).toBeTruthy();
    expect(h.skip).not.toHaveBeenCalled();
    fireEvent.click(lastButton("Skip next step"));
    await waitFor(() => expect(h.skip).toHaveBeenCalledWith({ id: "t1", dto: {} }));
  });

  it("removing a round-run sends the enrollment id", async () => {
    h.items = [run({})];
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Remove from protocol" }));
    expect(await screen.findByText("Remove from FMD vaccine?")).toBeTruthy();
    expect(screen.getByText(/Other animals on the round are not affected/)).toBeTruthy();
    fireEvent.click(lastButton("Remove from protocol"));
    await waitFor(() => expect(h.stop).toHaveBeenCalledWith({ planEnrollmentId: "e1" }));
  });

  it("a treatment run is removed by case id and the dialog says the case stays open", async () => {
    h.items = [run({ runType: "CASE", id: "k1", healthCaseId: "k1", planEnrollmentId: null, healthPlan: { id: "p2", name: "Mastitis 5-day", category: "TREATMENT" } })];
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Remove from protocol" }));
    expect(await screen.findByText(/The sickness case stays open/)).toBeTruthy();
    fireEvent.click(lastButton("Remove from protocol"));
    await waitFor(() => expect(h.stop).toHaveBeenCalledWith({ healthCaseId: "k1" }));
  });

  it("without healthcare.update the animal's protocols are visible but there are no actions", () => {
    h.canUpdate = false;
    h.items = [run({})];
    renderSection();
    expect(screen.getByText("FMD vaccine")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Skip next step" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove from protocol" })).toBeNull();
  });
});
