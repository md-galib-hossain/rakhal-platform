import { useTranslations } from "next-intl";
import type { FeedRequirementBreakdown } from "../types";

/**
 * Where each headline number comes from (RFE-103 / RAKHAL-267's breakdown AC).
 *
 * The engine has returned this decomposition since RAKHAL-258 and nothing has ever rendered it.
 * It is the difference between "your cow needs 2.1 kg of protein" and "1.1 kg of that is just
 * keeping her alive, 0.7 is the milk, 0.3 is the pregnancy" — which is what tells a farmer
 * whether a number is worth acting on.
 *
 * A negative body-condition adjustment is legitimate: a cow above target condition is fed less,
 * so the row is shown signed rather than clamped.
 */
export function RequirementBreakdown({ breakdown }: { breakdown: FeedRequirementBreakdown }) {
  const t = useTranslations("feed.requirements");

  const sections = [
    {
      title: t("breakdownDm"),
      unit: "kg",
      rows: [
        { label: t("partLactation"), value: breakdown.dm.lactation },
        { label: t("partPregnancy"), value: breakdown.dm.pregnancy },
        { label: t("partHeifer"), value: breakdown.dm.heiferGrowth },
        { label: t("partBcs"), value: breakdown.dm.bcsAdjustment },
      ],
    },
    {
      title: t("breakdownMe"),
      unit: "MJ",
      rows: [
        { label: t("partMaintenance"), value: breakdown.me.maintenance },
        { label: t("partMilk"), value: breakdown.me.milk },
        { label: t("partPregnancy"), value: breakdown.me.pregnancy },
        { label: t("partHeifer"), value: breakdown.me.heiferGrowth },
      ],
    },
    {
      title: t("breakdownCp"),
      unit: "kg",
      rows: [
        { label: t("partMaintenance"), value: breakdown.cp.maintenance },
        { label: t("partMilk"), value: breakdown.cp.milk },
        { label: t("partPregnancy"), value: breakdown.cp.pregnancy },
        { label: t("partHeifer"), value: breakdown.cp.heiferGrowth },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-card">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{t("breakdownTitle")}</p>
        <p className="text-xs text-muted-foreground">{t("breakdownSubtitle")}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {sections.map((section) => (
          <div
            key={section.title}
            className="flex flex-col gap-2 rounded-xl border border-border p-3"
          >
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {section.title}
            </span>
            <div className="flex flex-col divide-y divide-border">
              {section.rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  <span className="text-sm font-medium text-foreground">
                    {row.value.toFixed(2)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      {section.unit}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
