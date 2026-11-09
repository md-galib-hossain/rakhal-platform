export declare class PreviewLimiter {
    private readonly perFarm;
    private readonly global;
    private readonly perFarmCount;
    private total;
    constructor(perFarm: number, global: number);
    tryAcquire(farmId: string): (() => void) | null;
}
