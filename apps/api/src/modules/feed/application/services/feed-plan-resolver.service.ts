import { Injectable } from '@nestjs/common';
import { FeedPlanKind, FeedPlanLine } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { activeHerd } from 'src/modules/cattle/domain/herd-scope';

export type ProgramVia = 'INDIVIDUAL' | 'GROUP' | 'HERD';

/** The one feeding program a cow is on today (MILESTONE 27, ADR-027 D5). */
export interface ResolvedProgram {
  assignmentId: string;
  planId: string;
  planName: string;
  kind: FeedPlanKind;
  via: ProgramVia;
  /** Set when `via === 'GROUP'`. */
  groupId?: string;
  /** True when the cow is in more than one group that has an active program (ADR-027 D6): the most
   * recently applied group program is used until the overlap is fixed. */
  conflict: boolean;
  lines: FeedPlanLine[];
}

/** Precedence lives in `pickProgram` so it can be unit-tested without a database. */
export interface AssignmentRow {
  id: string;
  targetType: ProgramVia;
  cattleId: string | null;
  animalGroupId: string | null;
  appliedAt: Date;
  plan: {
    id: string;
    name: string;
    kind: FeedPlanKind;
    lines: FeedPlanLine[];
  };
}

/**
 * Pure precedence: **individual → group → herd → none** (ADR-027 D5). Among several groups the cow is
 * in, the most recently applied wins and `conflict` is raised (D6).
 */
export function pickProgram(
  individual: AssignmentRow | undefined,
  groupRows: AssignmentRow[],
  herd: AssignmentRow | undefined,
): ResolvedProgram | null {
  const build = (
    row: AssignmentRow,
    via: ProgramVia,
    conflict: boolean,
  ): ResolvedProgram => ({
    assignmentId: row.id,
    planId: row.plan.id,
    planName: row.plan.name,
    kind: row.plan.kind,
    via,
    ...(via === 'GROUP' && row.animalGroupId
      ? { groupId: row.animalGroupId }
      : {}),
    conflict,
    lines: row.plan.lines,
  });

  if (individual) return build(individual, 'INDIVIDUAL', false);
  if (groupRows.length > 0) {
    const sorted = [...groupRows].sort(
      (a, b) =>
        b.appliedAt.getTime() - a.appliedAt.getTime() ||
        b.id.localeCompare(a.id),
    );
    const distinctGroups = new Set(sorted.map((r) => r.animalGroupId));
    return build(sorted[0], 'GROUP', distinctGroups.size > 1);
  }
  if (herd) return build(herd, 'HERD', false);
  return null;
}

/**
 * Which feeding program each cow is on (MILESTONE 27, RAKHAL-456). Batched: a fixed number of
 * queries whatever the herd size (active herd filter, active assignments, group memberships).
 * Read-only. A cow outside the active herd (sold, dead, soft-deleted) resolves to nothing.
 */
@Injectable()
export class FeedPlanResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveForCattle(
    farmId: string,
    cattleIds: string[],
  ): Promise<Map<string, ResolvedProgram>> {
    const out = new Map<string, ResolvedProgram>();
    const ids = [...new Set(cattleIds)];
    if (ids.length === 0) return out;

    const [herd, assignments] = await Promise.all([
      this.prisma.cattle.findMany({
        where: { ...activeHerd(farmId), id: { in: ids } },
        select: { id: true },
      }),
      this.prisma.feedPlanAssignment.findMany({
        where: {
          farmId,
          removedAt: null,
          plan: { isActive: true },
          OR: [
            { targetType: 'INDIVIDUAL', cattleId: { in: ids } },
            { targetType: 'GROUP' },
            { targetType: 'HERD' },
          ],
        },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              kind: true,
              lines: { orderBy: { sortOrder: 'asc' } },
            },
          },
        },
      }),
    ]);
    const activeIds = herd.map((c) => c.id);
    if (activeIds.length === 0) return out;

    const individualByCow = new Map<string, AssignmentRow>();
    const groupById = new Map<string, AssignmentRow>();
    let herdRow: AssignmentRow | undefined;
    for (const a of assignments) {
      const row: AssignmentRow = { ...a, targetType: a.targetType };
      if (a.targetType === 'INDIVIDUAL' && a.cattleId)
        individualByCow.set(a.cattleId, row);
      else if (a.targetType === 'GROUP' && a.animalGroupId)
        groupById.set(a.animalGroupId, row);
      else if (a.targetType === 'HERD') herdRow = row;
    }

    const membersOf = new Map<string, AssignmentRow[]>();
    if (groupById.size > 0) {
      const members = await this.prisma.animalGroupMember.findMany({
        where: {
          farmId,
          cattleId: { in: activeIds },
          groupId: { in: [...groupById.keys()] },
        },
        select: { cattleId: true, groupId: true },
      });
      for (const m of members) {
        const list = membersOf.get(m.cattleId) ?? [];
        const row = groupById.get(m.groupId);
        if (row) list.push(row);
        membersOf.set(m.cattleId, list);
      }
    }

    for (const id of activeIds) {
      const picked = pickProgram(
        individualByCow.get(id),
        membersOf.get(id) ?? [],
        herdRow,
      );
      if (picked) out.set(id, picked);
    }
    return out;
  }
}
