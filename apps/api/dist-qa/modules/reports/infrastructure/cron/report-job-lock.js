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
exports.PgAdvisoryJobLock = exports.REPORT_JOB_LOCK = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
exports.REPORT_JOB_LOCK = Symbol('REPORT_JOB_LOCK');
const LOCK_TX_TIMEOUT_MS = 30 * 60 * 1000;
const LOCK_TX_MAX_WAIT_MS = 5_000;
let PgAdvisoryJobLock = class PgAdvisoryJobLock {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async runExclusive(jobName, fn) {
        const key = `reports:${jobName}`;
        return this.prisma.$transaction(async (tx) => {
            const rows = await tx.$queryRaw `SELECT pg_try_advisory_xact_lock(hashtext(${key})) AS locked`;
            if (!rows[0]?.locked)
                return { acquired: false };
            return { acquired: true, value: await fn() };
        }, { timeout: LOCK_TX_TIMEOUT_MS, maxWait: LOCK_TX_MAX_WAIT_MS });
    }
};
exports.PgAdvisoryJobLock = PgAdvisoryJobLock;
exports.PgAdvisoryJobLock = PgAdvisoryJobLock = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PgAdvisoryJobLock);
//# sourceMappingURL=report-job-lock.js.map