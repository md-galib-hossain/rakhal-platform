/**
 * In-memory concurrency limiter for live previews: at most `perFarm` at once per farm and `global`
 * per process. `tryAcquire` returns a release function (idempotent) or null when busy. Callers MUST
 * release in `finally` so an error never leaks a slot.
 */
export class PreviewLimiter {
  private readonly perFarmCount = new Map<string, number>();
  private total = 0;

  constructor(
    private readonly perFarm: number,
    private readonly global: number,
  ) {}

  tryAcquire(farmId: string): (() => void) | null {
    const farmCount = this.perFarmCount.get(farmId) ?? 0;
    if (farmCount >= this.perFarm || this.total >= this.global) return null;
    this.perFarmCount.set(farmId, farmCount + 1);
    this.total += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.total -= 1;
      const left = (this.perFarmCount.get(farmId) ?? 1) - 1;
      if (left <= 0) this.perFarmCount.delete(farmId);
      else this.perFarmCount.set(farmId, left);
    };
  }
}
