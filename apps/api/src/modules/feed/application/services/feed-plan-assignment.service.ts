import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityLogModule,
  FeedPlanAssignment,
  FeedPlanTarget,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { getCursorArgs, toCursorPage } from 'src/common/pagination';
import { activeHerd } from 'src/modules/cattle/domain/herd-scope';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import {
  ApplyFeedPlanDto,
  ListPlanAssignmentsQueryDto,
} from '../../presentation/dto/feed-plan.dto';
import { FeedPlanResolverService } from './feed-plan-resolver.service';

type Target = {
  targetType: FeedPlanTarget;
  cattleId: string | null;
  animalGroupId: string | null;
};

/**
 * Apply / Remove a feed plan (MILESTONE 27, RAKHAL-456, ADR-027 D4–D6). A plan does nothing until
 * applied. One active assignment per target; **Apply replaces** the target's active assignment in one
 * transaction, **Remove** ends it. No dates or scheduling. Ended rows are kept for audit.
 *
 * Overlap guard (D6): applying a GROUP program is refused (409) when a member would otherwise resolve
 * to a *different* group's active program — members that carry their own individual program are not
 * counted, since the individual one wins anyway.
 */
@Injectable()
export class FeedPlanAssignmentService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
    private readonly resolver: FeedPlanResolverService,
    private readonly activityLog: ActivityLogService,
  ) {
    this.log = logger.setContext(FeedPlanAssignmentService.name);
  }

  async apply(
    farmId: string,
    userId: string,
    planId: string,
    dto: ApplyFeedPlanDto,
  ) {
    const plan = await this.prisma.feedPlan.findFirst({
      where: { id: planId, farmId, isActive: true },
      select: { id: true, name: true },
    });
    if (!plan) throw new NotFoundException('Feed plan not found');

    const targets = await this.resolveTargets(farmId, dto);
    if (dto.targetType === 'GROUP') {
      await this.assertNoGroupOverlap(farmId, dto.animalGroupId as string);
    }

    // Before-state for the confirm text: which cows currently sit on a group program and are about to
    // leave it because an individual program now wins.
    const leavesGroupProgram =
      dto.targetType === 'INDIVIDUAL'
        ? [
            ...(await this.resolver.resolveForCattle(
              farmId,
              dto.cattleIds ?? [],
            )),
          ]
            .filter(([, p]) => p.via === 'GROUP')
            .map(([cattleId, p]) => ({
              cattle_id: cattleId,
              group_id: p.groupId ?? null,
              plan_id: p.planId,
              plan_name: p.planName,
            }))
        : [];

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        const existing = await tx.feedPlanAssignment.findMany({
          where: {
            farmId,
            removedAt: null,
            OR: targets.map((t) => this.targetWhere(t)),
          },
          include: { plan: { select: { name: true } } },
        });
        if (existing.length > 0) {
          await tx.feedPlanAssignment.updateMany({
            where: { id: { in: existing.map((e) => e.id) } },
            data: { removedAt: now, removedBy: userId },
          });
        }
        const created: FeedPlanAssignment[] = [];
        for (const t of targets) {
          created.push(
            await tx.feedPlanAssignment.create({
              data: {
                farmId,
                planId,
                targetType: t.targetType,
                cattleId: t.cattleId,
                animalGroupId: t.animalGroupId,
                appliedAt: now,
                appliedBy: userId,
              },
            }),
          );
        }
        return { existing, created };
      });

      await this.audit(
        farmId,
        userId,
        'Feed program applied',
        `"${plan.name}" applied to ${this.describe(dto, targets.length)}`,
        dto.targetType === 'INDIVIDUAL' && targets.length === 1
          ? targets[0].cattleId
          : null,
      );
      this.log.info('Feed plan applied', {
        farmId,
        planId,
        targetType: dto.targetType,
        targets: targets.length,
        replaced: result.existing.length,
      });

      return {
        plan_id: plan.id,
        assignments: result.created.map((a) => this.mapAssignment(a)),
        replaced: result.existing.map((e) => ({
          ...this.mapAssignment({ ...e, removedAt: e.removedAt }),
          plan_name: e.plan.name,
        })),
        leaves_group_program: leavesGroupProgram,
      };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        // Two applies raced for the same target; the partial unique index held the line.
        throw new ConflictException(
          'Another program was applied to this target at the same moment — try again',
        );
      }
      throw e;
    }
  }

  async remove(farmId: string, userId: string, assignmentId: string) {
    const row = await this.prisma.feedPlanAssignment.findFirst({
      where: { id: assignmentId, farmId },
      include: { plan: { select: { name: true } } },
    });
    if (!row) throw new NotFoundException('Program assignment not found');
    if (row.removedAt) {
      throw new ConflictException('This program has already been removed');
    }
    const updated = await this.prisma.feedPlanAssignment.update({
      where: { id: assignmentId },
      data: { removedAt: new Date(), removedBy: userId },
    });
    await this.audit(
      farmId,
      userId,
      'Feed program removed',
      `"${row.plan.name}" removed from ${this.describeRow(row)}`,
      row.cattleId,
    );
    this.log.info('Feed plan assignment removed', {
      farmId,
      assignmentId,
      userId,
    });
    return { ...this.mapAssignment(updated), plan_name: row.plan.name };
  }

  /** Ends every active assignment of a plan (`DELETE /feed/plans/:id?removeAssignments=true`). Runs in
   * the caller's transaction so "remove from all & delete" is one atomic action. */
  async removeAllForPlan(
    tx: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    planId: string,
  ) {
    const res = await tx.feedPlanAssignment.updateMany({
      where: { farmId, planId, removedAt: null },
      data: { removedAt: new Date(), removedBy: userId },
    });
    return res.count;
  }

  async countActive(farmId: string, planId: string) {
    return this.prisma.feedPlanAssignment.count({
      where: { farmId, planId, removedAt: null },
    });
  }

  /** Where each plan is applied right now: cow ids, group ids, and whether it is the herd default. */
  async appliedTo(farmId: string, planIds: string[]) {
    const out = new Map<
      string,
      { cattle_ids: string[]; group_ids: string[]; herd: boolean }
    >();
    if (planIds.length === 0) return out;
    const rows = await this.prisma.feedPlanAssignment.findMany({
      where: { farmId, planId: { in: planIds }, removedAt: null },
      select: {
        planId: true,
        targetType: true,
        cattleId: true,
        animalGroupId: true,
      },
    });
    for (const r of rows) {
      const e = out.get(r.planId) ?? {
        cattle_ids: [],
        group_ids: [],
        herd: false,
      };
      if (r.targetType === 'INDIVIDUAL' && r.cattleId)
        e.cattle_ids.push(r.cattleId);
      else if (r.targetType === 'GROUP' && r.animalGroupId)
        e.group_ids.push(r.animalGroupId);
      else if (r.targetType === 'HERD') e.herd = true;
      out.set(r.planId, e);
    }
    return out;
  }

  async list(farmId: string, query: ListPlanAssignmentsQueryDto) {
    const rows = await this.prisma.feedPlanAssignment.findMany({
      where: {
        farmId,
        ...(query.cattleId ? { cattleId: query.cattleId } : {}),
        ...(query.animalGroupId ? { animalGroupId: query.animalGroupId } : {}),
        ...(query.planId ? { planId: query.planId } : {}),
        ...(query.status === 'ACTIVE' ? { removedAt: null } : {}),
        ...(query.status === 'ENDED' ? { removedAt: { not: null } } : {}),
      },
      include: { plan: { select: { name: true, kind: true } } },
      orderBy: [{ appliedAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });
    const page = toCursorPage(rows, query);
    return {
      items: page.items.map((r) => ({
        ...this.mapAssignment(r),
        plan_name: r.plan.name,
        plan_kind: r.plan.kind,
      })),
      meta: page.meta,
    };
  }

  // ---- internals ----------------------------------------------------------

  private async resolveTargets(
    farmId: string,
    dto: ApplyFeedPlanDto,
  ): Promise<Target[]> {
    if (dto.targetType === 'HERD') {
      return [{ targetType: 'HERD', cattleId: null, animalGroupId: null }];
    }
    if (dto.targetType === 'GROUP') {
      const group = await this.prisma.animalGroup.findFirst({
        where: { id: dto.animalGroupId, farmId, deletedAt: null },
        select: { id: true },
      });
      if (!group) throw new NotFoundException('Animal group not found');
      return [{ targetType: 'GROUP', cattleId: null, animalGroupId: group.id }];
    }
    const ids = [...new Set(dto.cattleIds ?? [])];
    const found = await this.prisma.cattle.findMany({
      where: { ...activeHerd(farmId), id: { in: ids } },
      select: { id: true },
    });
    const missing = ids.filter((id) => !found.some((c) => c.id === id));
    if (missing.length > 0) {
      throw new NotFoundException(
        `Cattle not found in the active herd: ${missing.join(', ')}`,
      );
    }
    return found.map((c) => ({
      targetType: 'INDIVIDUAL' as const,
      cattleId: c.id,
      animalGroupId: null,
    }));
  }

  private targetWhere(t: Target): Prisma.FeedPlanAssignmentWhereInput {
    if (t.targetType === 'HERD') return { targetType: 'HERD' };
    if (t.targetType === 'GROUP')
      return { targetType: 'GROUP', animalGroupId: t.animalGroupId };
    return { targetType: 'INDIVIDUAL', cattleId: t.cattleId };
  }

  /** D6: refuse when any member would resolve to a different group's active program. */
  private async assertNoGroupOverlap(farmId: string, groupId: string) {
    const members = await this.prisma.animalGroupMember.findMany({
      where: { farmId, groupId },
      select: { cattleId: true },
    });
    if (members.length === 0) return;
    const active = await this.prisma.cattle.findMany({
      where: {
        ...activeHerd(farmId),
        id: { in: members.map((m) => m.cattleId) },
      },
      select: { id: true },
    });
    const memberIds = active.map((c) => c.id);
    if (memberIds.length === 0) return;

    const [others, individual] = await Promise.all([
      this.prisma.animalGroupMember.findMany({
        where: {
          farmId,
          cattleId: { in: memberIds },
          groupId: { not: groupId },
        },
        select: { cattleId: true, groupId: true },
      }),
      this.prisma.feedPlanAssignment.findMany({
        where: {
          farmId,
          removedAt: null,
          targetType: 'INDIVIDUAL',
          cattleId: { in: memberIds },
        },
        select: { cattleId: true },
      }),
    ]);
    if (others.length === 0) return;

    const groupAssignments = await this.prisma.feedPlanAssignment.findMany({
      where: {
        farmId,
        removedAt: null,
        targetType: 'GROUP',
        animalGroupId: { in: [...new Set(others.map((o) => o.groupId))] },
      },
      include: { plan: { select: { name: true } } },
    });
    const programByGroup = new Map(
      groupAssignments.map((a) => [
        a.animalGroupId as string,
        { plan_id: a.planId, plan_name: a.plan.name },
      ]),
    );
    const hasOwn = new Set(individual.map((i) => i.cattleId as string));

    const conflicting = others
      .filter((o) => !hasOwn.has(o.cattleId) && programByGroup.has(o.groupId))
      .map((o) => ({
        cattle_id: o.cattleId,
        group_id: o.groupId,
        ...programByGroup.get(o.groupId),
      }));
    if (conflicting.length > 0) {
      throw new ConflictException({
        message:
          'Some animals in this group are already on another group’s program. Remove that program, or give them an individual one, first.',
        details: { conflicting_cattle: conflicting },
      });
    }
  }

  private mapAssignment(a: FeedPlanAssignment) {
    return {
      id: a.id,
      plan_id: a.planId,
      target_type: a.targetType,
      cattle_id: a.cattleId,
      animal_group_id: a.animalGroupId,
      applied_at: a.appliedAt,
      applied_by: a.appliedBy,
      removed_at: a.removedAt,
      removed_by: a.removedBy,
    };
  }

  private describe(dto: ApplyFeedPlanDto, count: number) {
    if (dto.targetType === 'HERD') return 'the whole herd';
    if (dto.targetType === 'GROUP') return `group ${dto.animalGroupId}`;
    return `${count} animal${count === 1 ? '' : 's'}`;
  }

  private describeRow(r: Target) {
    if (r.targetType === 'HERD') return 'the whole herd';
    if (r.targetType === 'GROUP') return `group ${r.animalGroupId}`;
    return `animal ${r.cattleId}`;
  }

  /** An audit-log hiccup must never fail the already-committed apply/remove. */
  private async audit(
    farmId: string,
    actorId: string,
    eventTitle: string,
    actionDetails: string,
    relatedCattleId: string | null,
  ) {
    try {
      await this.activityLog.record({
        farmId,
        module: ActivityLogModule.INVENTORY,
        eventTitle,
        actionDetails,
        actorId,
        relatedCattleId,
      });
    } catch (err) {
      this.log.error('Feed program activity log failed', {
        farmId,
        eventTitle,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
