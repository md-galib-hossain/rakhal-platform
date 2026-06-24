import { ActivityLogModule } from '@prisma/client';

/**
 * AQR (Animal Quality Rating) event catalogue — the configurable delta table
 * from PRD §19.2. Each AQR-impacting event adjusts a cow's score and writes an
 * Activity Log entry. Deltas are the launch defaults; PRD §25.7 (AQR-04) makes
 * them configurable in Rakhaal Admin — wire that override in RAKHAL-110.
 */
export interface AqrEventDef {
  /** Score change applied (ignored when `nullify`). */
  delta: number;
  /** When true the score is set to null (removed from the herd mean), e.g. mortality. */
  nullify?: boolean;
  module: ActivityLogModule;
  title: string;
}

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
