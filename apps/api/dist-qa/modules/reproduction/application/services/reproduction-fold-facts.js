"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadFoldFacts = loadFoldFacts;
const REPRO_TYPES = [
    'BREEDING',
    'PREG_CHECK',
    'CALVING',
    'ABORTION',
    'HEAT',
];
async function loadFoldFacts(db, cattleId) {
    const events = await db.animalEvent.findMany({
        where: { cattleId, status: 'ACTIVE', type: { in: [...REPRO_TYPES] } },
        select: { id: true, type: true, eventAt: true, provenance: true },
        orderBy: [{ eventAt: 'asc' }, { id: 'asc' }],
    });
    if (!events.length)
        return [];
    const ids = events.map((e) => e.id);
    const [breedings, diagnoses] = await Promise.all([
        db.breedingEvent.findMany({
            where: { animalEventId: { in: ids } },
            select: { animalEventId: true, status: true, breedingDate: true },
        }),
        db.pregnancyDiagnosis.findMany({
            where: { animalEventId: { in: ids } },
            select: {
                id: true,
                animalEventId: true,
                result: true,
                gestationDay: true,
                expectedCalvingDate: true,
                breedingEventId: true,
            },
        }),
    ]);
    const corrected = diagnoses.length
        ? await db.pregnancy.findMany({
            where: {
                cattleId,
                status: 'CANCELLED_CORRECTION',
                sourceDiagnosisId: { in: diagnoses.map((d) => d.id) },
            },
            select: { sourceDiagnosisId: true },
        })
        : [];
    const droppedEvents = new Set(diagnoses
        .filter((d) => corrected.some((p) => p.sourceDiagnosisId === d.id))
        .map((d) => d.animalEventId));
    const linkedIds = diagnoses
        .map((d) => d.breedingEventId)
        .filter((x) => Boolean(x));
    const linked = linkedIds.length
        ? await db.breedingEvent.findMany({
            where: { id: { in: linkedIds } },
            select: { id: true, breedingDate: true },
        })
        : [];
    const linkedDate = new Map(linked.map((b) => [b.id, b.breedingDate]));
    const breedingByEvent = new Map(breedings.map((b) => [b.animalEventId, b]));
    const diagByEvent = new Map(diagnoses.map((d) => [d.animalEventId, d]));
    const facts = events
        .filter((e) => !droppedEvents.has(e.id))
        .map((e) => {
        const base = {
            id: e.id,
            type: e.type,
            at: e.eventAt,
            provenance: e.provenance,
        };
        if (e.type === 'BREEDING') {
            const b = breedingByEvent.get(e.id);
            return {
                ...base,
                open: b ? b.status === 'PENDING_CHECK' : true,
                endedInPregnancy: b?.status === 'PREGNANT',
            };
        }
        if (e.type === 'PREG_CHECK') {
            const d = diagByEvent.get(e.id);
            return {
                ...base,
                result: d?.result,
                gestationDay: d?.gestationDay ?? null,
                expectedCalvingDate: d?.expectedCalvingDate ?? null,
                breedingDate: d?.breedingEventId
                    ? (linkedDate.get(d.breedingEventId) ?? null)
                    : null,
            };
        }
        return base;
    });
    const active = await db.pregnancy.findFirst({
        where: { cattleId, status: 'ACTIVE' },
        select: {
            id: true,
            sourceDiagnosisId: true,
            createdAt: true,
            expectedCalvingDate: true,
        },
    });
    const covered = active?.sourceDiagnosisId &&
        facts.some((f) => f.type === 'PREG_CHECK' &&
            diagByEvent.get(f.id)?.id === active.sourceDiagnosisId);
    if (active && !covered) {
        facts.push({
            id: `legacy-pregnancy-${active.id}`,
            type: 'PREG_CHECK',
            at: active.createdAt,
            provenance: 'RECORDED',
            result: 'PREGNANT',
            expectedCalvingDate: active.expectedCalvingDate,
        });
    }
    return facts;
}
//# sourceMappingURL=reproduction-fold-facts.js.map