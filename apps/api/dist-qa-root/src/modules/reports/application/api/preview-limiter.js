"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreviewLimiter = void 0;
class PreviewLimiter {
    perFarm;
    global;
    perFarmCount = new Map();
    total = 0;
    constructor(perFarm, global) {
        this.perFarm = perFarm;
        this.global = global;
    }
    tryAcquire(farmId) {
        const farmCount = this.perFarmCount.get(farmId) ?? 0;
        if (farmCount >= this.perFarm || this.total >= this.global)
            return null;
        this.perFarmCount.set(farmId, farmCount + 1);
        this.total += 1;
        let released = false;
        return () => {
            if (released)
                return;
            released = true;
            this.total -= 1;
            const left = (this.perFarmCount.get(farmId) ?? 1) - 1;
            if (left <= 0)
                this.perFarmCount.delete(farmId);
            else
                this.perFarmCount.set(farmId, left);
        };
    }
}
exports.PreviewLimiter = PreviewLimiter;
//# sourceMappingURL=preview-limiter.js.map