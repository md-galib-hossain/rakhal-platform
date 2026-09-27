import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import type {
  RequirementOverrideDetail,
  FeedRequirements,
} from "@/features/feed/types";
import { RequirementOverrideCard } from "./requirement-override-card";

// Permissions: the card gates on `feed.update` only. `Can` renders `fallback` without it (a worker).
const h = vi.hoisted(() => ({
  perms: new Set<string>(),
  detail: null as unknown,
}));
vi.mock("@/lib/auth/permissions", () => ({
  Can: ({
    I,
    children,
    fallback = null,
  }: {
    I: string;
    children: React.ReactNode;
    fallback?: React.ReactNode;
  }) => (h.perms.has(I) ? children : fallback),
  useCan: () => (p: string) => h.perms.has(p),
}));
vi.mock("@/features/feed/hooks/use-requirement-override", () => ({
  useRequirementOverride: () => ({
    isLoading: false,
    isError: false,
    data: h.detail,
    refetch: vi.fn(),
  }),
  useRequirementOverrideHistory: () => ({
    items: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    page: 1,
    totalPages: 1,
    goToPage: vi.fn(),
  }),
  useSetRequirementOverride: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTurnOffRequirementOverride: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

const req = (dm: number, cp: number, me: number): FeedRequirements =>
  ({
    dm_kg: dm,
    cp_kg: cp,
    me_mj: me,
    calcium_kg: null,
    phosphorus_kg: null,
    breakdown: null,
  }) as unknown as FeedRequirements;

const inputs = { weight_kg: 450, milk_target_l: 12 };

const manualDetail = (
  stale: boolean,
  typeChanged = false,
): RequirementOverrideDetail =>
  ({
    active: {
      id: "o1",
      dm_kg: 9,
      cp_kg: 1.3,
      me_mj: 95,
      note: "dry-period figures",
    },
    last: null,
    resolved: {
      cattle_id: "c1",
      source: "MANUAL",
      inputs,
      flags: [],
      requirements: req(9, 1.3, 95),
      dynamic_requirements: req(12.5, 1.9, 130),
      manual: {
        override_id: "o1",
        set_at: "2026-09-26T00:00:00Z",
        set_by: "u1",
        note: "dry-period figures",
        stale,
        drift: { dm_pct: 28, cp_pct: 31, me_pct: 27 },
        animal_type_changed: typeChanged,
      },
    },
  }) as unknown as RequirementOverrideDetail;

const calculatedDetail = {
  active: null,
  last: null,
  resolved: {
    cattle_id: "c1",
    source: "DYNAMIC",
    inputs,
    flags: [],
    requirements: req(12.5, 1.9, 130),
  },
} as unknown as RequirementOverrideDetail;

function renderCard() {
  return render(
    <NextIntlClientProvider locale="en" messages={en as never}>
      <RequirementOverrideCard cattleId="c1" />
    </NextIntlClientProvider>,
  );
}

describe("RequirementOverrideCard (MILESTONE 28, RFE-129)", () => {
  beforeEach(() => {
    h.perms = new Set();
  });

  it("worker: read-only — a mode badge, the manual-vs-calculated table and the stale warning, but no way to change anything", () => {
    h.detail = manualDetail(true);
    renderCard();
    expect(screen.getByText("Nutrition requirement")).toBeInTheDocument();
    expect(screen.getAllByText("Manual").length).toBeGreaterThan(0); // the badge
    expect(
      screen.queryByRole("group", { name: "How her requirement is set" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Change values" })).toBeNull();
    expect(screen.queryByRole("switch", { name: "Manual" })).toBeNull();
    expect(screen.getByText(/changed by about 31%/)).toBeInTheDocument();
    expect(screen.getByText("Note: dry-period figures")).toBeInTheDocument();
  });

  it("worker on a calculated cow: just the calculated summary and a Calculated badge", () => {
    h.detail = calculatedDetail;
    renderCard();
    expect(screen.getAllByText("Calculated").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/12.5 kg dry matter, 1.9 kg protein and 130 MJ/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Manual" })).toBeNull();
  });

  it("manager: the Manual toggle switch and Change values button are there", () => {
    h.perms = new Set(["feed.update"]);
    h.detail = manualDetail(false);
    renderCard();
    expect(
      screen.getByRole("group", { name: "How her requirement is set" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Manual" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Change values" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/changed by about/)).toBeNull(); // not stale
  });

  it("a change of stage is called out instead of a percentage", () => {
    h.detail = manualDetail(true, true);
    renderCard();
    expect(
      screen.getByText(/Her stage has changed since you set this/),
    ).toBeInTheDocument();
  });
});

// ---- MILESTONE 28b (RFE-131): the whole nutrient profile ------------------------------------------------

/** A calculated profile with every figure, as the API sends it. */
const fullReq = (): FeedRequirements =>
  ({
    dm_kg: 12.5,
    cp_kg: 1.9,
    me_mj: 130,
    ne_mcal: 22.4,
    energy_density_mj_per_kg_dm: 10.4,
    cp_pct_of_dm: 15.2,
    rdp_pct: 62,
    rup_pct: 38,
    ndf_kg: 4.4,
    ndf_max_kg: 5.2,
    adf_kg: 3,
    fat_kg: 0.6,
    tdn_kg: 8,
    calcium_kg: 0.09,
    phosphorus_kg: 0.05,
    ca_p_ratio_target: 1.8,
    breakdown: null,
  }) as unknown as FeedRequirements;

const fullCalculated = {
  active: null,
  last: null,
  calculated: fullReq(),
  resolved: {
    cattle_id: "c1",
    source: "DYNAMIC",
    inputs,
    flags: [],
    requirements: fullReq(),
  },
} as unknown as RequirementOverrideDetail;

describe("RequirementOverrideCard — full profile (MILESTONE 28b, RFE-131)", () => {
  beforeEach(() => {
    h.perms = new Set(["feed.update"]);
    h.detail = fullCalculated;
  });

  it("Calculated shows every section and nutrient read-only — no inputs", () => {
    renderCard();
    for (const label of [
      "Intake and energy",
      "Protein",
      "Fibre and fat",
      "Digestible nutrients",
      "Minerals",
      "Net energy (NEL)",
      "Degradable protein (RDP)",
      "NDF (maximum)",
      "TDN",
      "Calcium",
      "Phosphorus",
      "Calcium : phosphorus",
    ]) {
      expect(screen.getAllByText(new RegExp(label.replace(/[()]/g, "\\$&"))).length).toBeGreaterThan(0);
    }
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.getByText("Using calculated values")).toBeInTheDocument();
    expect(screen.getByText(/Applies to this cow everywhere/)).toBeInTheDocument();
  });

  it("turning on Manual switch opens a form with every nutrient, and nothing is on until Save", () => {
    renderCard();
    fireEvent.click(screen.getByRole("switch", { name: "Manual" }));
    // 12 inputs + the optional note.
    expect(screen.getAllByRole("textbox")).toHaveLength(13);
    expect(screen.getByText(/Not saved yet/)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Manual" })).toHaveAttribute("aria-checked", "true");
    // Pre-filled with today's calculated figures.
    expect(screen.getByLabelText("Calcium (kg)")).toHaveValue("0.09");
    expect(screen.getByLabelText("TDN (kg)")).toHaveValue("8");
  });

  it("derived rows follow what is typed, and a row can be reset to the calculated value", () => {
    renderCard();
    fireEvent.click(screen.getByRole("switch", { name: "Manual" }));
    const dm = screen.getByLabelText("Dry matter (kg)");
    fireEvent.change(dm, { target: { value: "10" } });
    // ME 130 / DM 10 = 13 MJ per kg dry matter.
    const density = screen.getByText(/Energy density/).closest("div") as HTMLElement;
    expect(within(density).getByText(/13/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reset Dry matter to the calculated value" }));
    expect(dm).toHaveValue("12.5");
  });

  it("a worker sees the full profile but no switch, form or edit button", () => {
    h.perms = new Set();
    renderCard();
    expect(screen.getByText("Calcium")).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Manual" })).toBeNull();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("a manual row saved before 28b explains that the rest follows the farm's shares", () => {
    h.detail = manualDetail(false);
    renderCard();
    expect(screen.getByText(/before the full profile existed/)).toBeInTheDocument();
  });
});
