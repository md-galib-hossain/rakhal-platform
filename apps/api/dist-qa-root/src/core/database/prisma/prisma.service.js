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
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const client_1 = require("@prisma/client");
const env_1 = require("src/core/config/env");
const tx_context_1 = require("./tx-context");
let PrismaService = class PrismaService extends client_1.PrismaClient {
    pool;
    constructor(dbConfig) {
        const pool = new pg_1.Pool({
            connectionString: dbConfig.url,
            max: 25,
            idleTimeoutMillis: 30000,
        });
        const adapter = new adapter_pg_1.PrismaPg(pool);
        super({ adapter });
        this.pool = pool;
        return new Proxy(this, {
            get(target, prop, receiver) {
                const store = tx_context_1.txStore.getStore();
                if (store && typeof prop === 'string') {
                    const tx = store.tx;
                    if (prop === '$transaction') {
                        return async (arg) => {
                            if (typeof arg === 'function') {
                                return arg(store.tx);
                            }
                            const out = [];
                            for (const p of arg)
                                out.push(await p);
                            return out;
                        };
                    }
                    if (prop in tx) {
                        const v = tx[prop];
                        return (typeof v === 'function' && prop.startsWith('$')
                            ? v.bind(store.tx)
                            : v);
                    }
                }
                return Reflect.get(target, prop, receiver);
            },
        });
    }
    async onModuleInit() {
        await this.$connect();
    }
    async onModuleDestroy() {
        await this.$disconnect();
        await this.pool.end();
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(env_1.databaseConfig.KEY)),
    __metadata("design:paramtypes", [void 0])
], PrismaService);
//# sourceMappingURL=prisma.service.js.map