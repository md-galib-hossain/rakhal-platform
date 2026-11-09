import { FeedPlanKind, FeedPlanLine } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
export type ProgramVia = 'INDIVIDUAL' | 'GROUP' | 'HERD';
export interface ResolvedProgram {
    assignmentId: string;
    planId: string;
    planName: string;
    kind: FeedPlanKind;
    via: ProgramVia;
    groupId?: string;
    conflict: boolean;
    lines: FeedPlanLine[];
}
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
export declare function pickProgram(individual: AssignmentRow | undefined, groupRows: AssignmentRow[], herd: AssignmentRow | undefined): ResolvedProgram | null;
export declare class FeedPlanResolverService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    resolveForCattle(farmId: string, cattleIds: string[]): Promise<Map<string, ResolvedProgram>>;
}
