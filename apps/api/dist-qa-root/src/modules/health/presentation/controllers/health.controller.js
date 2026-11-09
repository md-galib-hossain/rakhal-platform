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
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const health_service_1 = require("../../application/services/health.service");
const health_outcomes_service_1 = require("../../application/services/health-outcomes.service");
const health_plan_stats_service_1 = require("../../application/services/health-plan-stats.service");
const health_rounds_service_1 = require("../../application/services/health-rounds.service");
const case_actions_dto_1 = require("../dto/case-actions.dto");
const create_health_case_dto_1 = require("../dto/create-health-case.dto");
const bulk_create_health_cases_dto_1 = require("../dto/bulk-create-health-cases.dto");
const update_health_case_dto_1 = require("../dto/update-health-case.dto");
const health_plan_dto_1 = require("../dto/health-plan.dto");
const health_query_dto_1 = require("../dto/health-query.dto");
const health_rounds_dto_1 = require("../dto/health-rounds.dto");
const swagger_1 = require("@nestjs/swagger");
let HealthController = class HealthController {
    healthService;
    outcomesService;
    planStatsService;
    roundsService;
    constructor(healthService, outcomesService, planStatsService, roundsService) {
        this.healthService = healthService;
        this.outcomesService = outcomesService;
        this.planStatsService = planStatsService;
        this.roundsService = roundsService;
    }
    dashboard(farmId) {
        return this.healthService.getHealthDashboard(farmId);
    }
    outcomes(farmId, query) {
        return this.outcomesService.getOutcomes(farmId, query.days ?? 90);
    }
    morbidityTrend(farmId, query) {
        return this.outcomesService.getMorbidityTrend(farmId, query.days);
    }
    sickBay(farmId, query) {
        return this.healthService.getSickBay(farmId, query);
    }
    createCase(farmId, userId, dto) {
        return this.healthService.createHealthCase(farmId, userId, dto);
    }
    createCasesBulk(farmId, userId, dto) {
        return this.healthService.createHealthCasesBulk(farmId, userId, dto);
    }
    getTreatmentLogs(farmId, query) {
        return this.healthService.getTreatmentLogs(farmId, query);
    }
    recordTreatment(farmId, userId, dto) {
        return this.healthService.recordTreatment(farmId, userId, dto);
    }
    getPlanApplications(farmId, query) {
        return this.healthService.getPlanApplications(farmId, query);
    }
    getCase(farmId, id) {
        return this.healthService.getHealthCase(farmId, id);
    }
    updateCase(farmId, id, dto) {
        return this.healthService.updateHealthCase(farmId, id, dto);
    }
    deleteCase(farmId, userId, id) {
        return this.healthService.deleteCase(farmId, userId, id);
    }
    applyPlan(farmId, id, dto) {
        return this.healthService.applyHealthPlanToCase(farmId, id, dto);
    }
    logTreatment(farmId, userId, id, dto) {
        return this.healthService.logTreatment(farmId, userId, id, dto);
    }
    healthUpdate(farmId, userId, id, dto) {
        return this.healthService.createHealthUpdate(farmId, userId, id, dto);
    }
    closeCase(farmId, userId, id, dto) {
        return this.healthService.closeCase(farmId, userId, id, dto);
    }
    mortality(farmId, userId, id, dto) {
        return this.healthService.logMortality(farmId, userId, id, dto);
    }
    async getPlans(farmId, query) {
        return this.planStatsService.attach(farmId, await this.healthService.getPlans(farmId, query));
    }
    createPlan(farmId, userId, dto) {
        return this.healthService.createPlan(farmId, userId, dto);
    }
    async getPlan(farmId, id) {
        const plan = await this.healthService.getPlanForView(farmId, id);
        const stats = await this.planStatsService.statsFor(farmId, [plan]);
        return { ...plan, stats: stats.get(plan.id) };
    }
    getPlanRuns(farmId, id, query) {
        return this.healthService.getPlanRuns(farmId, id, query);
    }
    getRounds(farmId, query) {
        return this.roundsService.list(farmId, query);
    }
    getRoundGrid(farmId, roundKey, query) {
        return this.roundsService.grid(farmId, roundKey, query);
    }
    addRoundAnimals(farmId, userId, roundKey, dto) {
        return this.roundsService.addAnimals(farmId, userId, roundKey, dto);
    }
    cancelRound(farmId, userId, roundKey, dto) {
        return this.roundsService.cancelRound(farmId, userId, roundKey, dto.reason);
    }
    voidTreatment(farmId, userId, id, dto) {
        return this.healthService.voidTreatmentLog(farmId, userId, id, dto.reason);
    }
    stockCheck(farmId, id, animals) {
        return this.healthService.stockCheck(farmId, id, Number(animals) || 1);
    }
    updatePlan(farmId, id, dto) {
        return this.healthService.updatePlan(farmId, id, dto);
    }
    deletePlan(farmId, id) {
        return this.healthService.deletePlan(farmId, id);
    }
    applyPlanToAnimals(farmId, userId, id, dto) {
        return this.healthService.applyPlanToAnimals(farmId, userId, id, dto);
    }
    getTasks(farmId, query) {
        return this.healthService.getTasks(farmId, query);
    }
    taskCalendar(farmId, query) {
        return this.healthService.getTaskCalendar(farmId, query);
    }
    completeTask(farmId, userId, id) {
        return this.healthService.completeTask(farmId, userId, id);
    }
    logTaskTreatment(farmId, userId, id, dto) {
        return this.healthService.logTaskTreatment(farmId, userId, id, dto);
    }
    rescheduleTask(farmId, id, dto) {
        return this.healthService.rescheduleTask(farmId, id, dto);
    }
    skipTask(farmId, id, dto) {
        return this.healthService.skipTask(farmId, id, dto);
    }
    getSafetyWithdrawals(farmId, query) {
        return this.healthService.getSafetyWithdrawals(farmId, query);
    }
    refreshSafetyWithdrawals(farmId) {
        return this.healthService.refreshSafetyWithdrawals(farmId);
    }
    releaseWithdrawal(farmId, id, userId) {
        return this.healthService.releaseWithdrawal(farmId, id, userId);
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Get)('outcomes'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, health_query_dto_1.HealthOutcomesQueryDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "outcomes", null);
__decorate([
    (0, common_1.Get)('morbidity-trend'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, health_query_dto_1.MorbidityTrendQueryDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "morbidityTrend", null);
__decorate([
    (0, common_1.Get)('sick-bay'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, health_query_dto_1.SickBayQueryDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "sickBay", null);
__decorate([
    (0, common_1.Post)('cases'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.report-sickness'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, create_health_case_dto_1.CreateHealthCaseDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "createCase", null);
__decorate([
    (0, common_1.Post)('cases/bulk'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.report-sickness'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, bulk_create_health_cases_dto_1.BulkCreateHealthCasesDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "createCasesBulk", null);
__decorate([
    (0, common_1.Get)('treatments'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, health_query_dto_1.TreatmentLogsQueryDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "getTreatmentLogs", null);
__decorate([
    (0, common_1.Post)('treatments'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.log-treatment'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, case_actions_dto_1.RecordTreatmentDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "recordTreatment", null);
__decorate([
    (0, common_1.Get)('plan-applications'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, health_query_dto_1.AppliedPlansQueryDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "getPlanApplications", null);
__decorate([
    (0, common_1.Get)('cases/:id'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "getCase", null);
__decorate([
    (0, common_1.Patch)('cases/:id'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_health_case_dto_1.UpdateHealthCaseDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "updateCase", null);
__decorate([
    (0, common_1.Delete)('cases/:id'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.delete'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "deleteCase", null);
__decorate([
    (0, common_1.Post)('cases/:id/apply-plan'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, case_actions_dto_1.ApplyHealthPlanDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "applyPlan", null);
__decorate([
    (0, common_1.Post)('cases/:id/log-treatment'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.log-treatment'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, case_actions_dto_1.LogTreatmentDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "logTreatment", null);
__decorate([
    (0, common_1.Post)('cases/:id/health-update'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.log-treatment'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, case_actions_dto_1.CreateHealthUpdateDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "healthUpdate", null);
__decorate([
    (0, common_1.Post)('cases/:id/close'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.close-case'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, case_actions_dto_1.CloseHealthCaseDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "closeCase", null);
__decorate([
    (0, common_1.Post)('cases/:id/mortality'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.close-case'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, case_actions_dto_1.MortalityDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "mortality", null);
__decorate([
    (0, common_1.Get)('plans'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, health_query_dto_1.HealthPlanQueryDto]),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "getPlans", null);
__decorate([
    (0, common_1.Post)('plans'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.create'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, health_plan_dto_1.CreateHealthPlanDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "createPlan", null);
__decorate([
    (0, common_1.Get)('plans/:id'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "getPlan", null);
__decorate([
    (0, common_1.Get)('plans/:id/runs'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, health_query_dto_1.PlanRunsQueryDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "getPlanRuns", null);
__decorate([
    (0, common_1.Get)('rounds'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, health_rounds_dto_1.RoundsQueryDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "getRounds", null);
__decorate([
    (0, common_1.Get)('rounds/:roundKey/grid'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('roundKey')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, health_rounds_dto_1.RoundGridQueryDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "getRoundGrid", null);
__decorate([
    (0, common_1.Post)('rounds/:roundKey/animals'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('roundKey')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, health_rounds_dto_1.AddRoundAnimalsDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "addRoundAnimals", null);
__decorate([
    (0, common_1.Post)('rounds/:roundKey/cancel'),
    (0, common_1.HttpCode)(200),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('roundKey')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, health_rounds_dto_1.UndoReasonDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "cancelRound", null);
__decorate([
    (0, common_1.Post)('treatments/:id/void'),
    (0, common_1.HttpCode)(200),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, health_rounds_dto_1.UndoReasonDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "voidTreatment", null);
__decorate([
    (0, common_1.Get)('plans/:id/stock-check'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('animals')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "stockCheck", null);
__decorate([
    (0, common_1.Patch)('plans/:id'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, health_plan_dto_1.UpdateHealthPlanDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "updatePlan", null);
__decorate([
    (0, common_1.Delete)('plans/:id'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.delete'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "deletePlan", null);
__decorate([
    (0, common_1.Post)('plans/:id/apply'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, health_plan_dto_1.ApplyPlanToAnimalsDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "applyPlanToAnimals", null);
__decorate([
    (0, common_1.Get)('tasks'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, health_query_dto_1.HealthTaskQueryDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "getTasks", null);
__decorate([
    (0, common_1.Get)('tasks/calendar'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, health_query_dto_1.HealthTaskCalendarQueryDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "taskCalendar", null);
__decorate([
    (0, common_1.Post)('tasks/:id/complete'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.log-treatment'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "completeTask", null);
__decorate([
    (0, common_1.Post)('tasks/:id/log-treatment'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.log-treatment'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, case_actions_dto_1.LogTaskTreatmentDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "logTaskTreatment", null);
__decorate([
    (0, common_1.Post)('tasks/:id/reschedule'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, case_actions_dto_1.RescheduleHealthTaskDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "rescheduleTask", null);
__decorate([
    (0, common_1.Post)('tasks/:id/skip'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, case_actions_dto_1.SkipHealthTaskDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "skipTask", null);
__decorate([
    (0, common_1.Get)('safety-withdrawals'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, health_query_dto_1.SafetyWithdrawalQueryDto]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "getSafetyWithdrawals", null);
__decorate([
    (0, common_1.Post)('safety-withdrawals/refresh'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "refreshSafetyWithdrawals", null);
__decorate([
    (0, common_1.Post)('safety-withdrawals/:id/release'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, decorators_1.CurrentUserId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "releaseWithdrawal", null);
exports.HealthController = HealthController = __decorate([
    (0, swagger_1.ApiTags)('Health'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('health'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __metadata("design:paramtypes", [health_service_1.HealthService,
        health_outcomes_service_1.HealthOutcomesService,
        health_plan_stats_service_1.HealthPlanStatsService,
        health_rounds_service_1.HealthRoundsService])
], HealthController);
//# sourceMappingURL=health.controller.js.map