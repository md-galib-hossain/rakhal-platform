import { CustomEventTypeService } from '../../application/services/custom-event-type.service';
export declare class CreateCustomTypeDto {
    name: string;
    group: string;
    appliesTo?: Record<string, string>;
    fields: unknown[];
    followUpDays?: number | null;
}
export declare class UpdateCustomTypeDto {
    name?: string;
    group?: string;
    appliesTo?: Record<string, string>;
    fields?: unknown[];
    followUpDays?: number | null;
}
export declare class CustomTypesController {
    private readonly types;
    constructor(types: CustomEventTypeService);
    list(farmId: string): import("@prisma/client").Prisma.PrismaPromise<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        group: string;
        isActive: boolean;
        appliesTo: import("@prisma/client/runtime/client").JsonValue;
        fields: import("@prisma/client/runtime/client").JsonValue;
        followUpDays: number | null;
    }[]>;
    create(farmId: string, dto: CreateCustomTypeDto): Promise<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        group: string;
        isActive: boolean;
        appliesTo: import("@prisma/client/runtime/client").JsonValue;
        fields: import("@prisma/client/runtime/client").JsonValue;
        followUpDays: number | null;
    }>;
    update(farmId: string, id: string, dto: UpdateCustomTypeDto): Promise<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        group: string;
        isActive: boolean;
        appliesTo: import("@prisma/client/runtime/client").JsonValue;
        fields: import("@prisma/client/runtime/client").JsonValue;
        followUpDays: number | null;
    }>;
    remove(farmId: string, id: string): Promise<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        group: string;
        isActive: boolean;
        appliesTo: import("@prisma/client/runtime/client").JsonValue;
        fields: import("@prisma/client/runtime/client").JsonValue;
        followUpDays: number | null;
    }>;
}
