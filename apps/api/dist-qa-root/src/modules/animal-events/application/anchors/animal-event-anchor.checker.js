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
exports.AnimalEventAnchorChecker = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const source_resolver_registry_1 = require("src/modules/notification/application/resolvers/source-resolver.registry");
let AnimalEventAnchorChecker = class AnimalEventAnchorChecker {
    prisma;
    registry;
    anchorType = 'ANIMAL_EVENT';
    constructor(prisma, registry) {
        this.prisma = prisma;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.registerAnchorChecker(this);
    }
    async exists(farmId, anchorId) {
        const ev = await this.prisma.animalEvent.findFirst({
            where: { id: anchorId, farmId, status: { not: 'VOIDED' } },
            select: { id: true },
        });
        return ev !== null;
    }
};
exports.AnimalEventAnchorChecker = AnimalEventAnchorChecker;
exports.AnimalEventAnchorChecker = AnimalEventAnchorChecker = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        source_resolver_registry_1.SourceResolverRegistry])
], AnimalEventAnchorChecker);
//# sourceMappingURL=animal-event-anchor.checker.js.map