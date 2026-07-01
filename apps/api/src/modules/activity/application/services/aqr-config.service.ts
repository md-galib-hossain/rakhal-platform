import { Injectable } from '@nestjs/common';
import {
  AQR_DEFAULT_BOUNDS,
  AQR_EVENTS,
  AqrBounds,
  AqrEventDef,
  AqrEventKey,
} from '../../domain/aqr-events';

/** Per-farm AQR override bundle (resolved from Admin config — RAKHAL-110). */
export interface FarmAqrOverrides {
  events?: Partial<Record<AqrEventKey, AqrEventDef>>;
  bounds?: AqrBounds;
}

/**
 * AQR configuration provider (PRD §19.4, §25.7 AQR-04..08; ADR-008/009).
 *
 * The single seam through which the AQR engine resolves its tunable algorithm
 * parameters — per-event deltas / nullify behaviour, and the score clamp
 * bounds. {@link AqrService} depends ONLY on this provider, never on the static
 * catalogue, so the algorithm can be re-tuned without touching the engine.
 *
 * Resolution order (per parameter): **farm override → Admin global default →
 * built-in launch default**. Today no overrides are stored, so every farm falls
 * through to the built-in defaults ({@link AQR_EVENTS}, {@link AQR_DEFAULT_BOUNDS}).
 * The **Rakhal Admin panel** integration (RAKHAL-110) will populate
 * {@link overridesFor} from the Admin-managed config (global defaults +
 * per-`farmId` overrides) — no engine change required. Config changes are
 * non-retroactive (applied to future events only) and audited.
 */
@Injectable()
export class AqrConfigService {
  /**
   * Per-farm overrides, keyed by `farmId`. Empty until the Admin sync
   * (RAKHAL-110) hydrates it; the engine reads through {@link resolveEvent} /
   * {@link resolveBounds} so behaviour is identical to the launch defaults
   * until an override is present.
   */
  private readonly overrides = new Map<string, FarmAqrOverrides>();

  /** Resolve the active definition (delta/nullify/title/module) for an event. */
  async resolveEvent(
    farmId: string,
    eventKey: AqrEventKey,
  ): Promise<AqrEventDef> {
    const farm = await this.overridesFor(farmId);
    return farm.events?.[eventKey] ?? AQR_EVENTS[eventKey];
  }

  /** Resolve the active score clamp bounds for a farm (AQR-01). */
  async resolveBounds(farmId: string): Promise<AqrBounds> {
    const farm = await this.overridesFor(farmId);
    return farm.bounds ?? AQR_DEFAULT_BOUNDS;
  }

  /**
   * Resolve a farm's effective overrides. Stub today (returns whatever is in the
   * in-memory map, i.e. nothing) — RAKHAL-110 replaces the body with a cached
   * fetch from Rakhal Admin (global defaults merged with per-farm overrides).
   */
  private overridesFor(farmId: string): Promise<FarmAqrOverrides> {
    return Promise.resolve(this.overrides.get(farmId) ?? {});
  }
}
