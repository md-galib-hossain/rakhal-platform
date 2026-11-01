import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import bn from "@/i18n/messages/bn.json";
import type { TimelineEvent } from "../../timeline-model";
import { TimelineRow } from "./timeline-row";

function row(over: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: "e1",
    type: "WEIGHT",
    eventAt: "2026-10-28T07:10:00.000Z",
    provenance: "RECORDED",
    status: "ACTIVE",
    notes: null,
    findings: null,
    batchId: null,
    sourceEventId: null,
    detail: { weightKg: 412 },
    ...over,
  };
}

function renderRow(event: TimelineEvent, locale: "en" | "bn" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn} timeZone="Asia/Dhaka">
      <ol>
        <TimelineRow event={event} />
      </ol>
    </NextIntlClientProvider>,
  );
}

describe("TimelineRow", () => {
  it("shows the type, a weight summary and a time for a recorded event", () => {
    renderRow(row());
    expect(screen.getByText("Weighed")).toBeInTheDocument();
    expect(screen.getByText("412 kg")).toBeInTheDocument();
    expect(screen.queryByText("History")).not.toBeInTheDocument();
  });
  it("tags HISTORICAL entries and drops the time of day", () => {
    const { container } = renderRow(row({ provenance: "HISTORICAL" }));
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(container.querySelector("time")).toBeNull();
  });
  it("strikes a voided row through and labels it", () => {
    renderRow(row({ status: "VOIDED" }));
    expect(screen.getByText("Voided")).toBeInTheDocument();
    expect(screen.getByText("Weighed")).toHaveClass("line-through");
  });
  it("shows the linked follow-up line only when sourceEventId is set", () => {
    const { rerender } = renderRow(row());
    expect(screen.queryByText("Follows from an earlier event")).not.toBeInTheDocument();
    rerender(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
        <ol>
          <TimelineRow event={row({ sourceEventId: "ai1" })} />
        </ol>
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Follows from an earlier event")).toBeInTheDocument();
  });
  it("renders notes and a warning tag when findings were accepted", () => {
    renderRow(row({ type: "HEAT", detail: null, notes: "Standing heat", findings: [{ code: "HEAT_WHILE_PREGNANT" }] }));
    expect(screen.getByText("Standing heat")).toBeInTheDocument();
    expect(screen.getByText("Check")).toBeInTheDocument();
  });
  it("renders in Bangla", () => {
    renderRow(row({ provenance: "HISTORICAL" }), "bn");
    expect(screen.getByText("ওজন")).toBeInTheDocument();
    expect(screen.getByText("পুরনো তথ্য")).toBeInTheDocument();
  });
  it("shows the recorder's first name and the AI summary, never an id", () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
        <ol>
          <TimelineRow
            event={row({ type: "BREEDING", detail: { breedingMethod: "AI", sireNameOrCode: "Sultan" }, recordedById: "cmuf4t0ve0049hofca2egbu8w" })}
            actorName="Galib Hossain"
          />
        </ol>
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("GH")).toBeInTheDocument();
    expect(screen.getByText("AI · bull Sultan")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/cmuf4t0/);
  });
  it("tints the icon by group", () => {
    const { container } = renderRow(row({ type: "HEAT", detail: { detectionMethod: "VISUAL" } }));
    expect(container.querySelector("span.bg-accent-pink-tint")).not.toBeNull();
  });
});
