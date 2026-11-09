"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.METRIC_REGISTRY = exports.METRIC_MODULES = void 0;
exports.buildMetricRegistry = buildMetricRegistry;
const feed_1 = require("./feed");
const finance_1 = require("./finance");
const health_1 = require("./health");
const milk_1 = require("./milk");
const repro_1 = require("./repro");
exports.METRIC_MODULES = {
    milk: milk_1.milkMetricModule,
    health: health_1.healthMetricModule,
    reproduction: repro_1.reproMetricModule,
    finance: finance_1.financeMetricModule,
    feed: feed_1.feedMetricModule,
};
function buildMetricRegistry(modules = exports.METRIC_MODULES) {
    const registry = {};
    for (const mod of Object.values(modules)) {
        if (!mod)
            continue;
        for (const def of mod.definitions) {
            if (registry[def.id])
                throw new Error(`Duplicate metric id "${def.id}"`);
            registry[def.id] = def;
        }
    }
    return registry;
}
exports.METRIC_REGISTRY = buildMetricRegistry();
//# sourceMappingURL=registry.js.map