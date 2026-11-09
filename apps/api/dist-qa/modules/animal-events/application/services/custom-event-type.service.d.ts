import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
export interface CustomTypeInput {
    name: string;
    group: string;
    appliesTo?: Record<string, string>;
    fields: unknown[];
    followUpDays?: number | null;
}
export declare class CustomEventTypeService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(farmId: string, includeInactive?: boolean): Prisma.PrismaPromise<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        group: string;
        isActive: boolean;
        appliesTo: Prisma.JsonValue;
        fields: Prisma.JsonValue;
        followUpDays: number | null;
    }[]>;
    get(farmId: string, id: string): Promise<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        group: string;
        isActive: boolean;
        appliesTo: Prisma.JsonValue;
        fields: Prisma.JsonValue;
        followUpDays: number | null;
    }>;
    create(farmId: string, input: CustomTypeInput): Promise<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        group: string;
        isActive: boolean;
        appliesTo: Prisma.JsonValue;
        fields: Prisma.JsonValue;
        followUpDays: number | null;
    }>;
    update(farmId: string, id: string, input: Partial<CustomTypeInput>): Promise<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        group: string;
        isActive: boolean;
        appliesTo: Prisma.JsonValue;
        fields: Prisma.JsonValue;
        followUpDays: number | null;
    }>;
    deactivate(farmId: string, id: string): Promise<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        group: string;
        isActive: boolean;
        appliesTo: Prisma.JsonValue;
        fields: Prisma.JsonValue;
        followUpDays: number | null;
    }>;
    private check;
}
