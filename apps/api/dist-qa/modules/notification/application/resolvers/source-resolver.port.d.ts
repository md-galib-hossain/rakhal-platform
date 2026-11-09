export type ResolverSourceType = 'TASK' | 'HEALTH_STEP';
export type ResolverAnchorType = 'ANIMAL_EVENT' | 'TASK' | 'HEALTH_STEP';
export interface ResolveContext {
    farmId: string;
    sourceKey: string;
    timezone: string;
    now: Date;
    leadMinutes: number;
    anchorAt: Date;
}
export type SourceResolution = {
    state: 'GONE';
} | {
    state: 'ANIMALS_GONE';
} | {
    state: 'OK';
    userIds: string[];
    roles?: string[];
    params: Record<string, string | number>;
    title: string;
    message: string;
    link?: string;
    data?: Record<string, unknown>;
};
export interface SourceResolver {
    readonly sourceType: ResolverSourceType;
    resolve(ctx: ResolveContext): Promise<SourceResolution>;
}
export interface AnchorChecker {
    readonly anchorType: ResolverAnchorType;
    exists(farmId: string, anchorId: string): Promise<boolean>;
}
