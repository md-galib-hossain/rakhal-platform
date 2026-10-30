import { describe, expect, it } from "vitest";
import { addDaysLocalIso } from "@/lib/local-date";
import { expandDate, isEmptyHistory, isHistoryRejected, isMonthOnly, previewItems, toHistoryPayload, toLegacyIntake, type HistoryValues } from "./history-model";

const today = "2026-10-30";
const kinds = (values: HistoryValues, gender = "FEMALE") => previewItems(values, gender, today).map((item) => item.kind);

describe("approximate dates", () => {
  it("a month-only answer is the middle of that month", () => {
    expect(isMonthOnly("2026-06")).toBe(true);
    expect(isMonthOnly("2026-06-10")).toBe(false);
    expect(expandDate("2026-06")).toBe("2026-06-15");
    expect(expandDate("2026-06-10")).toBe("2026-06-10");
  });
});

describe("previewItems (what we will set up)", () => {
  it("nothing answered, nothing created; Skip sends no history", () => {
    expect(isEmptyHistory({}, "FEMALE")).toBe(true);
    expect(toHistoryPayload({}, "FEMALE", today)).toBeUndefined();
    expect(toHistoryPayload({ calvedBefore: "no", pregnant: "no" }, "FEMALE", today)).toBeUndefined();
  });

  it("walkthrough A: last calving, pregnant with an expected date, no AI on file", () => {
    const values: HistoryValues = { calvedBefore: "yes", lastCalvingDate: "2026-06-10", calvingNumber: 2, pregnant: "yes", expectedCalvingDate: "2027-03-20" };
    const items = previewItems(values, "FEMALE", today);
    expect(items.map((i) => [i.kind, i.date, i.history])).toEqual([
      ["calving", "2026-06-10", true],
      ["pregnant", "2027-03-20", true],
      ["reminderDryOff", "2027-01-19", false],
    ]);
  });

  it("a cow pregnant for 2 months gets a calving due date and a dry-off reminder, with no AI record", () => {
    const items = previewItems({ pregnant: "yes", monthsPregnant: 2 }, "FEMALE", today);
    const due = addDaysLocalIso(today, 280 - 60);
    expect(items.map((i) => [i.kind, i.date])).toEqual([
      ["pregnant", due],
      ["reminderDryOff", addDaysLocalIso(due, -60)],
    ]);
    expect(kinds({ pregnant: "yes", monthsPregnant: 2 })).not.toContain("service");
  });

  it("reminders whose day has already passed are not listed", () => {
    expect(kinds({ pregnant: "yes", expectedCalvingDate: "2026-12-15" })).toEqual(["pregnant"]);
    expect(kinds({ lastBreedingDate: "2026-08-01" })).toEqual(["service"]);
    expect(kinds({ lastBreedingDate: "2026-10-20" })).toEqual(["service", "reminderPregCheck"]);
  });

  it("milking and dry follow the calved-before answer", () => {
    expect(kinds({ calvedBefore: "yes", lastCalvingDate: "2026-06-10", milkingNow: "yes", milkingSince: "2026-06-10" })).toEqual(["calving", "milking"]);
    expect(kinds({ calvedBefore: "yes", lastCalvingDate: "2026-01-10", milkingNow: "no", drySince: "2026-09-01" })).toEqual(["calving", "dry"]);
    expect(kinds({ calvedBefore: "no", milkingNow: "yes", milkingSince: "2026-06-10" })).toEqual([]);
  });

  it("a male offers only what applies: vaccination", () => {
    expect(kinds({ pregnant: "yes", monthsPregnant: 2, lastCalvingDate: "2026-06-10", calvedBefore: "yes", lastVaccinationDate: "2026-07-01" }, "MALE")).toEqual(["vaccination"]);
  });
});

describe("toHistoryPayload (the HistoryItemDto array)", () => {
  it("builds one {kind, ...} item per answer, with a month-only answer sent as mid-month", () => {
    const payload = toHistoryPayload(
      {
        calvedBefore: "yes", lastCalvingDate: "2026-06", calvingNumber: 3,
        milkingNow: "yes", milkingSince: "2026-06-12",
        pregnant: "yes", monthsPregnant: 2,
        lastBreedingDate: "2026-09-21", breedingMethod: "NATURAL", bull: " Rajat ",
        lastVaccinationDate: "2026-07-01", vaccineProduct: "FMD",
      },
      "FEMALE",
      today,
    );
    expect(payload).toEqual([
      { kind: "LAST_CALVING", date: "2026-06-15", calvingNumber: 3 },
      { kind: "LAST_BREEDING", date: "2026-09-21", method: "NATURAL", bull: "Rajat" },
      { kind: "PREGNANT", monthsPregnant: 2 },
      { kind: "MILKING_SINCE", date: "2026-06-12" },
      { kind: "LAST_VACCINATION", date: "2026-07-01", product: "FMD" },
    ]);
  });
  it("only sends properties the server accepts: no approx flag, kinds from the backend list", () => {
    const kinds = ["LAST_CALVING", "LAST_BREEDING", "PREGNANT", "MILKING_SINCE", "DRY_SINCE", "LAST_VACCINATION"];
    const allowed = new Set(["kind", "date", "calvingNumber", "method", "bull", "expectedCalvingDate", "monthsPregnant", "product"]);
    const payload = toHistoryPayload(
      { calvedBefore: "yes", lastCalvingDate: "2026-06", milkingNow: "no", drySince: "2026-09", lastBreedingDate: "2026-09", pregnant: "yes", expectedCalvingDate: "2027-03", lastVaccinationDate: "2026-07" },
      "FEMALE",
      today,
    )!;
    expect(Array.isArray(payload)).toBe(true);
    for (const item of payload) {
      expect(kinds).toContain(item.kind);
      for (const key of Object.keys(item)) expect(allowed.has(key), key).toBe(true);
    }
  });
  it("expected calving date wins over months; months are whole 1 to 9; a male sends only a vaccination", () => {
    expect(toHistoryPayload({ pregnant: "yes", expectedCalvingDate: "2027-03-20", monthsPregnant: 2 }, "FEMALE", today)).toEqual([{ kind: "PREGNANT", expectedCalvingDate: "2027-03-20" }]);
    expect(toHistoryPayload({ pregnant: "yes", monthsPregnant: 0.5 }, "FEMALE", today)).toEqual([{ kind: "PREGNANT", monthsPregnant: 1 }]);
    expect(toHistoryPayload({ pregnant: "yes", monthsPregnant: 2, lastVaccinationDate: "2026-07-01" }, "MALE", today)).toEqual([{ kind: "LAST_VACCINATION", date: "2026-07-01" }]);
  });
});

describe("toLegacyIntake (until the server accepts history)", () => {
  it("milking cow: MILKING, lactation start, prior calvings", () => {
    const { fields, dropped } = toLegacyIntake({ calvedBefore: "yes", lastCalvingDate: "2026-06-10", calvingNumber: 2, milkingNow: "yes", milkingSince: "2026-06-12" }, "FEMALE", today);
    expect(fields).toEqual({ priorCalvings: 2, productionStatus: "MILKING", lactationStartDate: "2026-06-12" });
    expect(dropped).toEqual([]);
  });
  it("milking with no start date falls back to the calving date", () => {
    expect(toLegacyIntake({ calvedBefore: "yes", lastCalvingDate: "2026-06-10", milkingNow: "yes" }, "FEMALE", today).fields).toEqual({
      priorCalvings: 1, productionStatus: "MILKING", lactationStartDate: "2026-06-10",
    });
  });
  it("dry cow: DRY with a dry-off start", () => {
    expect(toLegacyIntake({ calvedBefore: "yes", lastCalvingDate: "2026-01-10", calvingNumber: 3, milkingNow: "no", drySince: "2026-09-01" }, "FEMALE", today).fields).toEqual({
      priorCalvings: 3, productionStatus: "DRY", dryOffStartDate: "2026-09-01",
    });
  });
  it("pregnant 2 months: intakePregnancy from a conception date, no AI needed", () => {
    expect(toLegacyIntake({ pregnant: "yes", monthsPregnant: 2 }, "FEMALE", today).fields).toEqual({ intakePregnancy: { conceptionDate: addDaysLocalIso(today, -60) } });
    expect(toLegacyIntake({ pregnant: "yes", expectedCalvingDate: "2027-03-20" }, "FEMALE", today).fields).toEqual({ intakePregnancy: { expectedCalvingDate: "2027-03-20" } });
  });
  it("a service maps to intakeBreeding only when she is not pregnant; vaccination cannot be kept", () => {
    expect(toLegacyIntake({ pregnant: "no", lastBreedingDate: "2026-10-20", breedingMethod: "AI", bull: "Rajat" }, "FEMALE", today).fields).toEqual({
      intakeBreeding: { breedingDate: "2026-10-20", breedingMethod: "AI", notes: "Rajat" },
    });
    const pregnant = toLegacyIntake({ pregnant: "yes", monthsPregnant: 3, lastBreedingDate: "2026-08-01", lastVaccinationDate: "2026-07-01" }, "FEMALE", today);
    expect(pregnant.fields.intakeBreeding).toBeUndefined();
    expect(pregnant.dropped).toEqual(["service", "vaccination"]);
  });
});

describe("isHistoryRejected", () => {
  it("only a 400 that names history triggers the fallback", () => {
    expect(isHistoryRejected({ status: 400, message: "property history should not exist" })).toBe(true);
    expect(isHistoryRejected({ status: 400, message: "tagNumber must be unique" })).toBe(false);
    expect(isHistoryRejected({ status: 500, message: "history" })).toBe(false);
    expect(isHistoryRejected(null)).toBe(false);
  });
});
