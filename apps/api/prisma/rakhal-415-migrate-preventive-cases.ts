/**
 * RAKHAL-415 data migration: moves every existing preventive-diagnosisType `HealthCase` off
 * `HealthCase` and onto the new `PlanApplication`/`PlanEnrollment` tables — the shape a preventive
 * plan-apply produces going forward (`applyPreventivePlanToAnimals` in `health.service.ts`).
 *
 * **One `PlanApplication` + one `PlanEnrollment` per source case (1:1), not grouped.** The old
 * schema had no "round" concept, so there is no reliable way to tell which historical cases came
 * from the same original bulk-apply call versus separate ones — treating each case as its own
 * round is the only defensible, reversible choice; it does not lose or fabricate any grouping the
 * source data never actually recorded.
 *
 * Re-points each case's `HealthTask` rows (`healthCaseId` -> null, `planEnrollmentId` -> the new
 * enrollment) rather than duplicating them, so task history/dates survive unchanged. Soft-deletes
 * the source `HealthCase` (`deletedAt` set, never hard-deleted — reversible per the ticket's own
 * AC) so `TreatmentLog`/`HealthUpdate`/`SafetyWithdrawal` rows that still point at it keep
 * resolving. `HealthCase.status` maps to `PlanEnrollmentStatus`: an open status
 * (ACTIVE/IMPROVING/WORSENING/STABLE) becomes ACTIVE, everything else (RECOVERED/MORTALITY/CLOSED)
 * becomes COMPLETED.
 *
 * **Real edge case found in the live data, not hypothetical**: a preventive-diagnosisType case can
 * exist with `healthPlanId: null` — created via "Report Sickness" with a preventive diagnosis type
 * chosen directly, never through a plan-apply at all. `PlanApplication.healthPlanId` is a required
 * FK (a "round" only makes sense for an actual plan), so such a case has nothing to backfill it
 * into. These are soft-deleted on their own (no enrollment created) rather than left in place —
 * the AC's own "Sick Bay's row count must be unchanged by this migration" requirement means they
 * cannot be left both un-migrated AND un-excluded once the `notIn: PREVENTIVE_DIAGNOSIS_TYPES`
 * filter is removed from `getSickBay`. Logged separately below so this isn't a silent decision.
 *
 * Safe to run multiple times — a case already soft-deleted by a prior run is excluded by the
 * `deletedAt: null` filter. Same shape of one-off problem `prisma/cleanup-template-sourced-stock.ts`
 * (2026-07-19) and `prisma/rakhal-421-migrate-concentrate-feeditems.ts` (2026-09-13) solved.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const PREVENTIVE_DIAGNOSIS_TYPES = [
  'VACCINATION',
  'PREVENTIVE',
  'DEWORMING',
  'ROUTINE_CHECKUP',
  'BREEDING_RELATED',
] as const;

const OPEN_CASE_STATUSES = new Set([
  'ACTIVE',
  'IMPROVING',
  'WORSENING',
  'STABLE',
]);

async function main() {
  const candidates = await prisma.healthCase.findMany({
    where: {
      deletedAt: null,
      diagnosisType: { in: [...PREVENTIVE_DIAGNOSIS_TYPES] },
    },
    include: {
      tasks: { where: { deletedAt: null } },
      // `reportedBy`/`assignedVet` are free-text strings, not User FKs — the plan's own creator
      // is the only reliably-valid User id available in this historical data for `appliedBy`.
      healthPlan: { select: { createdBy: true } },
    },
  });
  console.log(
    `Found ${candidates.length} preventive HealthCase row(s) to migrate.`,
  );
  if (candidates.length === 0) return;

  let migratedToEnrollment = 0;
  let orphansSoftDeleted = 0;

  for (const healthCase of candidates) {
    if (!healthCase.healthPlanId) {
      // No plan to attach a round to — see the file-level doc comment's "Real edge case" note.
      await prisma.healthCase.update({
        where: { id: healthCase.id },
        data: { deletedAt: new Date() },
      });
      orphansSoftDeleted++;
      console.log(
        `  soft-deleted orphan case ${healthCase.id} (${healthCase.caseCode}) — preventive diagnosisType with no healthPlanId, nothing to enroll it into`,
      );
      continue;
    }

    const enrollmentStatus = OPEN_CASE_STATUSES.has(healthCase.status)
      ? 'ACTIVE'
      : 'COMPLETED';

    await prisma.$transaction(async (tx) => {
      const application = await tx.planApplication.create({
        data: {
          farmId: healthCase.farmId,
          healthPlanId: healthCase.healthPlanId!,
          startDate: healthCase.startDate,
          appliedBy: healthCase.healthPlan!.createdBy,
          animalCount: 1,
        },
      });
      const enrollment = await tx.planEnrollment.create({
        data: {
          farmId: healthCase.farmId,
          cattleId: healthCase.cattleId,
          healthPlanId: healthCase.healthPlanId!,
          planApplicationId: application.id,
          startDate: healthCase.startDate,
          status: enrollmentStatus,
          currentStep: healthCase.currentStep,
          totalSteps: healthCase.totalSteps,
          progressPercentage: healthCase.progressPercentage,
        },
      });
      if (healthCase.tasks.length > 0) {
        await tx.healthTask.updateMany({
          where: { id: { in: healthCase.tasks.map((t) => t.id) } },
          data: { healthCaseId: null, planEnrollmentId: enrollment.id },
        });
      }
      await tx.healthCase.update({
        where: { id: healthCase.id },
        data: { deletedAt: new Date() },
      });
    });
    migratedToEnrollment++;
  }

  console.log(
    `Migrated ${migratedToEnrollment} case(s) to PlanApplication/PlanEnrollment; soft-deleted ${orphansSoftDeleted} plan-less orphan case(s).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
