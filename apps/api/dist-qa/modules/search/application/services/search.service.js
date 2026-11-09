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
var SearchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const MIN_QUERY_LENGTH = 2;
const DEFAULT_LIMIT = 5;
let SearchService = SearchService_1 = class SearchService {
    prisma;
    log;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.log = logger.setContext(SearchService_1.name);
    }
    async search(farmId, rawQuery, limit = DEFAULT_LIMIT) {
        const q = rawQuery.trim();
        const results = {
            cattle: [],
            tasks: [],
            suppliers: [],
            buyers: [],
            sheds: [],
            medicines: [],
        };
        if (q.length < MIN_QUERY_LENGTH) {
            return { query: q, results, total: 0 };
        }
        const take = Math.min(Math.max(limit, 1), 20);
        const [cattle, tasks, suppliers, buyers, sheds, medicines] = await Promise.all([
            this.searchCattle(farmId, q, take),
            this.searchTasks(farmId, q, take),
            this.searchSuppliers(farmId, q, take),
            this.searchBuyers(farmId, q, take),
            this.searchSheds(farmId, q, take),
            this.searchMedicines(farmId, q, take),
        ]);
        results.cattle = cattle;
        results.tasks = tasks;
        results.suppliers = suppliers;
        results.buyers = buyers;
        results.sheds = sheds;
        results.medicines = medicines;
        const total = cattle.length +
            tasks.length +
            suppliers.length +
            buyers.length +
            sheds.length +
            medicines.length;
        return { query: q, results, total };
    }
    async searchCattle(farmId, q, take) {
        const like = `%${q}%`;
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT id,
             coalesce(name, "tagNumber") AS label,
             "tagNumber" AS sublabel,
             GREATEST(similarity(coalesce(name, ''), ${q}), similarity("tagNumber", ${q})) AS score
      FROM "Cattle"
      WHERE "farmId" = ${farmId} AND "deletedAt" IS NULL
        AND (coalesce(name, '') % ${q} OR "tagNumber" % ${q}
             OR name ILIKE ${like} OR "tagNumber" ILIKE ${like})
      ORDER BY score DESC, label ASC
      LIMIT ${take}
    `);
        return this.toHits(rows, (id) => `/cattle/${id}`);
    }
    async searchTasks(farmId, q, take) {
        const like = `%${q}%`;
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT id, name AS label, reference AS sublabel,
             GREATEST(similarity(name, ${q}), similarity(reference, ${q})) AS score
      FROM "Task"
      WHERE "farmId" = ${farmId}
        AND (name % ${q} OR reference % ${q}
             OR name ILIKE ${like} OR reference ILIKE ${like})
      ORDER BY score DESC, label ASC
      LIMIT ${take}
    `);
        return this.toHits(rows, (id) => `/tasks/${id}`);
    }
    async searchSuppliers(farmId, q, take) {
        const like = `%${q}%`;
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT id, name AS label, phone AS sublabel,
             GREATEST(similarity(name, ${q}), similarity(coalesce(phone, ''), ${q})) AS score
      FROM "Supplier"
      WHERE "farmId" = ${farmId} AND "deletedAt" IS NULL
        AND (name % ${q} OR name ILIKE ${like} OR coalesce(phone, '') ILIKE ${like})
      ORDER BY score DESC, label ASC
      LIMIT ${take}
    `);
        return this.toHits(rows, (id) => `/settings/suppliers/${id}`);
    }
    async searchBuyers(farmId, q, take) {
        const like = `%${q}%`;
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT id, name AS label, phone AS sublabel,
             GREATEST(similarity(name, ${q}), similarity(coalesce(phone, ''), ${q})) AS score
      FROM "MilkBuyer"
      WHERE "farmId" = ${farmId} AND "deletedAt" IS NULL
        AND (name % ${q} OR name ILIKE ${like} OR coalesce(phone, '') ILIKE ${like})
      ORDER BY score DESC, label ASC
      LIMIT ${take}
    `);
        return this.toHits(rows, (id) => `/milk/buyers/${id}`);
    }
    async searchSheds(farmId, q, take) {
        const like = `%${q}%`;
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT id, name AS label, code AS sublabel,
             GREATEST(similarity(name, ${q}), similarity(code, ${q})) AS score
      FROM "Shed"
      WHERE "farmId" = ${farmId} AND "deletedAt" IS NULL
        AND (name % ${q} OR code % ${q}
             OR name ILIKE ${like} OR code ILIKE ${like})
      ORDER BY score DESC, label ASC
      LIMIT ${take}
    `);
        return this.toHits(rows, (id) => `/settings/sheds/${id}`);
    }
    async searchMedicines(farmId, q, take) {
        const like = `%${q}%`;
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT id, name AS label, manufacturer AS sublabel,
             GREATEST(similarity(name, ${q}), similarity(coalesce(manufacturer, ''), ${q})) AS score
      FROM "Medicine"
      WHERE "farmId" = ${farmId} AND "deletedAt" IS NULL
        AND (name % ${q} OR name ILIKE ${like} OR coalesce(manufacturer, '') ILIKE ${like})
      ORDER BY score DESC, label ASC
      LIMIT ${take}
    `);
        return this.toHits(rows, (id) => `/inventory/medicine/${id}`);
    }
    toHits(rows, link) {
        return rows.map((r) => ({
            id: r.id,
            label: r.label ?? '',
            sublabel: r.sublabel,
            score: Number(r.score),
            link: link(r.id),
        }));
    }
};
exports.SearchService = SearchService;
exports.SearchService = SearchService = SearchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], SearchService);
//# sourceMappingURL=search.service.js.map