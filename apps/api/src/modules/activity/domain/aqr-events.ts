import { ActivityLogModule } from '@prisma/client';

/**
 * AQR (Animal Quality Rating) algorithm parameters — the tunable table from
 * PRD §19.2/§19.4. Each AQR-impacting event adjusts a cow's score and writes an
 * Activity Log entry.
 *
 * **These are LAUNCH DEFAULTS, not the source of truth at runtime.** The AQR
 * algorithm is designed to be controllable by the future **Rakhal Admin panel**
 * (PRD §25.7 AQR-04..08, ADR-008/009): the engine never reads this table
 * directly — it resolves every parameter through {@link AqrConfigService}, the
 * single seam the Admin integration (RAKHAL-110) backs with the global Admin
 * config + per-farm overrides. Resolution order: per-farm override → Admin
 * global default → these built-in defaults. Config changes are non-retroactive
 * (apply to future events only) and audited. So adjusting the algorithm later
 * (new events, different deltas, different clamp bounds) requires NO change to
 * the engine — only the config provider's backing store.
 */
export interface AqrEventDef {
  /** Score change applied (ignored when `nullify`). */
  delta: number;
  /** When true the score is set to null (removed from the herd mean), e.g. mortality. */
  nullify?: boolean;
  module: ActivityLogModule;
  title: string;
}

/** Score clamp bounds (PRD §25.7 AQR-01). Admin-tunable via {@link AqrConfigService}. */
export interface AqrBounds {
  min: number;
  max: number;
}

/** Launch-default clamp bounds (0–100). Overridable per-farm/global by Admin. */
export const AQR_DEFAULT_BOUNDS: AqrBounds = { min: 0, max: 100 };

export const AQR_EVENTS = {
  animal_registered: {
    delta: 50,
    module: ActivityLogModule.COW_MANAGEMENT,
    title: 'Animal Registered',
  },
  milk_session_logged: {
    delta: 0.5,
    module: ActivityLogModule.MILK_PRODUCTION,
    title: 'Milk Session Logged',
  },
  sickness_reported: {
    delta: -10,
    module: ActivityLogModule.HEALTH_SAFETY,
    title: 'Animal Sickness Reported',
  },
  preventive_care_logged: {
    delta: 0,
    module: ActivityLogModule.HEALTH_SAFETY,
    title: 'Preventive Care Logged',
  },
  recovered: {
    delta: 5,
    module: ActivityLogModule.HEALTH_SAFETY,
    title: 'Animal Recovered',
  },
  mortality: {
    delta: 0,
    nullify: true,
    module: ActivityLogModule.HEALTH_SAFETY,
    title: 'Animal Mortality',
  },
  calving_successful: {
    delta: 8,
    module: ActivityLogModule.BREEDING,
    title: 'Calving Recorded',
  },
  pregnancy_confirmed: {
    delta: 5,
    module: ActivityLogModule.BREEDING,
    title: 'Pregnancy Confirmed',
  },
  treatment_completed: {
    delta: 3,
    module: ActivityLogModule.HEALTH_SAFETY,
    title: 'Treatment Completed',
  },
} satisfies Record<string, AqrEventDef>;

export type AqrEventKey = keyof typeof AQR_EVENTS;
