import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import bn from "@/i18n/messages/bn.json";
import type { HealthCaseListItem } from "../types";
import { SickBayCard } from "./sick-bay-card";

const h = vi.hoisted(() => ({ perms: new Set<string>(["healthcare.update", "healthcare.delete"]) }));
vi.mock("@/lib/auth/permissions", () => ({
  Can: ({ I, children, fallback = null }: { I: string; children: React.ReactNode; fallback?: React.ReactNode }) => (h.perms.has(I) ? children : fallback),
  useCan: () => (p: string) => h.perms.has(p),
}));
vi.mock("@/components/shared/animal-link", () => ({
  AnimalLink: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

function makeCase(extra: Partial<HealthCaseListItem> = {}): HealthCaseListItem {
  return {
    id: "case1",
    caseCode: "HC-1",
    note: "Swollen udder",
    condition: "MASTITIS",
    careType: "CURATIVE",
    priority: "HIGH",
    status: "ACTIVE",
    shedId: null,
    shedName: "Shed A",
    startDate: daysAgo(3),
    expectedRecoveryDate: null,
    currentStep: 2,
    totalSteps: 5,
    progressPercentage: 40,
    symptoms: [],
    isSafetyWithholdingActive: false,
    cattle: { id: "cow1", name: "Lokkhi", tagNumber: "RKL-009", image: null },
    healthPlan: null,
    tasks: [],
    ...extra,
  };
}

function renderCard(item: HealthCaseListItem, opts: { locale?: "en" | "bn"; withdrawalDaysLeft?: number } = {}) {
  const locale = opts.locale ?? "en";
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn} timeZone="Asia/Dhaka">
      <SickBayCard item={item} withdrawalDaysLeft={opts.withdrawalDaysLeft} onManageCase={vi.fn()} onApplyProtocol={vi.fn()} onDelete={vi.fn()} />
    </NextIntlClientProvider>,
  );
}

describe("SickBayCard (RFE-134 phone layout)", () => {
  it("shows the animal, priority, day of illness and condition", () => {
    renderCard(makeCase());
    expect(screen.getByText("Lokkhi")).toBeTruthy();
    expect(screen.getByText("RKL-009 · Shed A")).toBeTruthy();
    expect(screen.getByText("High")).toBeTruthy();
    expect(screen.getByText("Day 4")).toBeTruthy(); // reported 3 days ago → day 4
    expect(screen.getByText("Mastitis")).toBeTruthy();
  });

  it("a case with no protocol offers 'Apply protocol' — an open loop, not a dash", () => {
    renderCard(makeCase({ healthPlan: null }));
    expect(screen.getByRole("button", { name: "Apply Protocol" })).toBeTruthy();
  });

  it("a case with a protocol shows its name and step progress instead", () => {
    renderCard(makeCase({ healthPlan: { id: "p1", name: "Clinical Mastitis (5-day)" } }));
    expect(screen.getByText("Clinical Mastitis (5-day)")).toBeTruthy();
    expect(screen.getByText("2/5")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Apply Protocol" })).toBeNull();
  });

  it("without update rights there is no apply button", () => {
    h.perms.delete("healthcare.update");
    renderCard(makeCase({ healthPlan: null }));
    expect(screen.queryByRole("button", { name: "Apply Protocol" })).toBeNull();
    h.perms.add("healthcare.update");
  });

  it("words the next step like the reminders, and shows the withdrawal days left", () => {
    const { unmount } = renderCard(
      makeCase({ tasks: [{ id: "t1", title: "Penicillin dose", dueDateTime: daysAgo(2) } as HealthCaseListItem["tasks"][number]] }),
      { withdrawalDaysLeft: 3 },
    );
    expect(screen.getByText("2 days overdue")).toBeTruthy();
    expect(screen.getByText("Penicillin dose")).toBeTruthy();
    expect(screen.getByText("3 days left")).toBeTruthy();
    unmount();

    renderCard(makeCase({ tasks: [{ id: "t2", title: "Check", dueDateTime: inDays(3) } as HealthCaseListItem["tasks"][number]] }));
    expect(screen.getByText("In 3 days")).toBeTruthy();
  });

  it("falls back to 'Withholding' when the row is withholding but no dated withdrawal is known", () => {
    renderCard(makeCase({ isSafetyWithholdingActive: true }));
    expect(screen.getByText("Withholding")).toBeTruthy();
  });

  it("renders in Bengali with no missing-message keys", () => {
    const { container } = renderCard(makeCase({ healthPlan: null, tasks: [{ id: "t", title: "x", dueDateTime: daysAgo(1) } as HealthCaseListItem["tasks"][number]] }), {
      locale: "bn",
      withdrawalDaysLeft: 2,
    });
    expect(container.textContent).not.toMatch(/health\.(sickBay|taskHub|reportSickness)/);
  });
});
