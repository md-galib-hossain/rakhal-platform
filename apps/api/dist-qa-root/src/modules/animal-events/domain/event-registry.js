"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventRegistry = void 0;
const catalogue_1 = require("./catalogue");
class EventRegistry {
    defs = new Map();
    register(def) {
        if (this.defs.has(def.type)) {
            throw new Error(`Event type already registered: ${def.type}`);
        }
        this.defs.set(def.type, def);
    }
    get(type) {
        return this.defs.get(type);
    }
    all() {
        return [...this.defs.values()];
    }
    static withCatalogue() {
        const registry = new EventRegistry();
        for (const def of catalogue_1.EVENT_CATALOGUE)
            registry.register(def);
        return registry;
    }
}
exports.EventRegistry = EventRegistry;
//# sourceMappingURL=event-registry.js.map