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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnimalEventTypesService = exports.EVENT_REGISTRY = void 0;
const common_1 = require("@nestjs/common");
const event_registry_1 = require("../../domain/event-registry");
const custom_type_1 = require("../../domain/custom-type");
const custom_event_type_service_1 = require("./custom-event-type.service");
exports.EVENT_REGISTRY = Symbol('EVENT_REGISTRY');
let AnimalEventTypesService = class AnimalEventTypesService {
    registry;
    customTypes;
    constructor(registry, customTypes) {
        this.registry = registry;
        this.customTypes = customTypes;
    }
    async list(farmId) {
        const custom = await this.customTypes.list(farmId);
        return [
            ...this.registry.all(),
            ...custom.map((row) => ({
                ...(0, custom_type_1.toDefinition)(row),
                customTypeId: row.id,
                name: row.name,
                fields: row.fields,
                followUpDays: row.followUpDays,
            })),
        ];
    }
};
exports.AnimalEventTypesService = AnimalEventTypesService;
exports.AnimalEventTypesService = AnimalEventTypesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(exports.EVENT_REGISTRY)),
    __metadata("design:paramtypes", [event_registry_1.EventRegistry,
        custom_event_type_service_1.CustomEventTypeService])
], AnimalEventTypesService);
//# sourceMappingURL=animal-event-types.service.js.map