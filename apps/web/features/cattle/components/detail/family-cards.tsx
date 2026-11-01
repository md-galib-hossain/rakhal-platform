"use client"; // opens the cow modal on click

import { useTranslations } from "next-intl";
import { Baby, Dna, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { useCattleDetailModal } from "../../context/cattle-detail-modal-context";
import type { CattlePedigree } from "../../detail-types";

type Person = { id: string | null; name: string | null; tag: string | null; farm_name?: string | null; is_external?: boolean };

const GRID = "grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-3";

function RelativeCard({ role, person: raw, missing }: { role: string; person: Person | null; missing: string }) {
  // The API sends a stub (no id/name/tag) for an unrecorded parent — treat it as absent.
  const person = raw && (raw.id || raw.name || raw.tag) ? raw : null;
  const { openCattleDetail } = useCattleDetailModal();
  const clickable = Boolean(person?.id);
  const label = person ? (person.name ?? person.tag ?? "—") : null;
  const body = (
    <>
      <span className="text-xs font-medium text-muted-foreground">{role}</span>
      {person ? (
        <>
          <span className="truncate text-sm font-semibold text-foreground">{label}</span>
          <span className="flex flex-wrap items-center gap-1.5">
            {person.tag && person.name ? <span className="truncate text-xs text-muted-foreground">{person.tag}</span> : null}
            {person.is_external || person.farm_name ? (
              <Badge variant="secondary" className="max-w-full truncate">{person.farm_name ?? "•"}</Badge>
            ) : null}
          </span>
        </>
      ) : (
        <span className="text-sm text-muted-foreground">{missing}</span>
      )}
    </>
  );
  const cls = cn(
    "flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-card p-3 text-start",
    clickable && "transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    !person && "border-dashed",
  );
  return clickable ? (
    <button type="button" className={cls} onClick={() => openCattleDetail(person!.id!)}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Workspace "Family" cards (RFE-183): dam, sire, siblings, offspring as plain cards that wrap by container width.
 * The pan/zoom ancestry tree stays below as the deep view. */
export function FamilyCards({ data }: { data: CattlePedigree }) {
  const t = useTranslations("cattle.detail.pedigree");
  const hasAny = data.dam || data.sire || data.offspring.length > 0 || data.siblings.length > 0;

  if (!hasAny) {
    return (
      <Card className="rounded-xl">
        <EmptyState icon={Dna} title={t("familyEmptyTitle")} description={t("familyEmptyDescription")} className="py-8" />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2" aria-label={t("parents")}>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Users className="size-4 text-muted-foreground" aria-hidden />
          {t("parents")}
        </h3>
        <div className={GRID}>
          <RelativeCard role={t("mother")} person={data.dam} missing={t("unknownParent")} />
          <RelativeCard role={t("father")} person={data.sire} missing={t("unknownParent")} />
        </div>
      </section>

      {data.siblings.length > 0 ? (
        <section className="flex flex-col gap-2" aria-label={t("siblingsTitle")}>
          <h3 className="text-sm font-semibold text-foreground">
            {t("siblingsTitle")} <span className="font-normal text-muted-foreground">({data.siblings.length})</span>
          </h3>
          <div className={GRID}>
            {data.siblings.map((s) => (
              <RelativeCard key={s.id ?? s.tag} role={s.relation === "full_sibling" ? t("fullSibling") : t("halfSibling")} person={s} missing="" />
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-2" aria-label={t("offspringTitle")}>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Baby className="size-4 text-muted-foreground" aria-hidden />
          {t("offspringTitle")} <span className="font-normal text-muted-foreground">({data.offspring.length})</span>
        </h3>
        {data.offspring.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">{t("noOffspring")}</p>
        ) : (
          <div className={GRID}>
            {data.offspring.map((o) => (
              <RelativeCard key={o.id} role={o.birth_date ?? t("offspringRole")} person={o} missing="" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
