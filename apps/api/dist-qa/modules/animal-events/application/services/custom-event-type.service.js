"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomEventTypeService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const custom_type_1 = require("../../domain/custom-type");
const parse_payload_1 = require("../parse-payload");
let CustomEventTypeService = class CustomEventTypeService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    list(farmId, includeInactive = false) {
        return this.prisma.animalEventTypeDef.findMany({
            where: { farmId, ...(includeInactive ? {} : { isActive: true }) },
            orderBy: { name: 'asc' },
        });
    }
    async get(farmId, id) {
        const row = await this.prisma.animalEventTypeDef.findFirst({
            where: { id, farmId },
        });
        if (!row)
            throw new common_1.NotFoundException('Custom event type not found');
        return row;
    }
    async create(farmId, input) {
        const data = this.check(input);
        try {
            return await this.prisma.animalEventTypeDef.create({
                data: { farmId, ...data },
            });
        }
        catch (e) {
            if (e.code === 'P2002')
                throw new common_1.ConflictException('A custom event type with this name exists');
            throw e;
        }
    }
    async update(farmId, id, input) {
        const current = await this.get(farmId, id);
        const data = this.check({
            name: input.name ?? current.name,
            group: input.group ?? current.group,
            appliesTo: input.appliesTo ?? current.appliesTo,
            fields: input.fields ?? current.fields,
            followUpDays: input.followUpDays === undefined
                ? current.followUpDays
                : input.followUpDays,
        });
        try {
            return await this.prisma.animalEventTypeDef.update({
                where: { id },
                data,
            });
        }
        catch (e) {
            if (e.code === 'P2002')
                throw new common_1.ConflictException('A custom event type with this name exists');
            throw e;
        }
    }
    async deactivate(farmId, id) {
        await this.get(farmId, id);
        return this.prisma.animalEventTypeDef.update({
            where: { id },
            data: { isActive: false },
        });
    }
    check(input) {
        const name = input.name?.trim();
        if (!name || name.length > 60)
            throw (0, parse_payload_1.eventError)('CUSTOM_TYPE_INVALID', 'name is required (max 60)');
        if (!custom_type_1.CUSTOM_GROUPS.includes(input.group))
            throw (0, parse_payload_1.eventError)('CUSTOM_TYPE_INVALID', `group must be one of ${custom_type_1.CUSTOM_GROUPS.join(', ')}`);
        const problems = (0, custom_type_1.validateFields)(input.fields);
        if (problems.length)
            throw (0, parse_payload_1.eventError)('CUSTOM_TYPE_INVALID', 'fields are invalid', {
                problems,
            });
        const appliesTo = (0, custom_type_1.normalizeAppliesTo)(input.appliesTo);
        if (!appliesTo)
            throw (0, parse_payload_1.eventError)('CUSTOM_TYPE_INVALID', 'appliesTo values must be LISTED, WARN or BLOCK');
        if (input.followUpDays != null &&
            !(input.followUpDays >= 1 && input.followUpDays <= 365))
            throw (0, parse_payload_1.eventError)('CUSTOM_TYPE_INVALID', 'followUpDays must be 1 to 365');
        return {
            name,
            group: input.group,
            appliesTo: appliesTo,
            fields: input.fields,
            followUpDays: input.followUpDays ?? null,
        };
    }
};
exports.CustomEventTypeService = CustomEventTypeService;
exports.CustomEventTypeService = CustomEventTypeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CustomEventTypeService);
//# sourceMappingURL=custom-event-type.service.js.map