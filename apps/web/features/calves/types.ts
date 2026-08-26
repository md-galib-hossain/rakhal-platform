/**
 * Mirrors `rakhal-backend/src/modules/calf` response shapes exactly, read directly from
 * `calf.controller.ts` / `calf.service.ts` / the Prisma schema (`calf.enums.prisma`) — RFE-033 has
 * no Figma frames, so these shapes (not a mock/aspirational contract) are the sole source of truth.
 * A calf IS a `Cattle` row with `purpose = CALF`; on wean it moves out of this module entirely
 * (see `WeanCalfResult`), so there is no `calf.create` route — calves originate only from
 * Reproduction's calving-event flow (`features/reproduction`).
 */

export type CalfStage = "newborn" | "young" | "pre_weaning" | "post_weaning";
export type CalfHealthStatus = "healthy" | "concern";
export type CalfGender = "MALE" | "FEMALE" | "CASTRATED_MALE";
export type ColostrumQuality = "EXCELLENT" | "GOOD" | "POOR" | "UNKNOWN";
export type CalfMilkType = "DAM_MILK" | "WHOLE_MILK" | "MILK_REPLACER";
export type CalfStarterEventType = "FIRST_OFFERED" | "FIRST_INTAKE" | "DAILY_INTAKE";

export interface CalfDamRef {
  id: string;
  name: string | null;
  tagNumber: string;
}

// ---- GET /calves -----------------------------------------------------------

export interface CalfListItem {
  id: string;
  name: string | null;
  tagNumber: string;
  ageDays: number;
  gender: CalfGender;
  stage: CalfStage;
  dam: CalfDamRef | null;
  birthWeightKg: number | null;
  currentWeightKg: number | null;
  adgKgDay: number | null;
  healthStatus: CalfHealthStatus;
  fedToday: boolean;
  weaningDueDate: string | null;
}

export interface CalfKpis {
  totalCalves: number;
  fedToday: number;
  healthConcern: number;
  weaningDueThisWeek: number;
}

export interface CalfListFilters {
  search?: string;
  stage?: CalfStage;
  healthStatus?: CalfHealthStatus;
}

// ---- GET /calves/:id --------------------------------------------------------

export interface CalfColostrumRecord {
  id: string;
  calfId: string;
  feedNumber: number;
  fedAt: string;
  volumeMl: number;
  quality: ColostrumQuality;
  fedBy: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CalfMilkFeeding {
  id: string;
  calfId: string;
  date: string;
  morningMl: number;
  eveningMl: number;
  type: CalfMilkType;
  notes: string | null;
  createdAt: string;
  totalMl: number;
}

export interface CalfWeightPoint {
  date: string;
  weightKg: number;
  adgToDate: number | null;
}

export interface CalfStarterFeedSummary {
  firstOfferedDate: string | null;
  firstIntakeDate: string | null;
  currentDailyIntakeG: number | null;
}

export interface CalfWeaningRecord {
  id: string;
  calfId: string;
  weaningDate: string;
  weaningWeightKg: number | null;
  adgAtWeaning: number | null;
  notes: string | null;
  createdAt: string;
}

export interface CalfUpcomingTask {
  id: string;
  name: string;
  dueAt: string;
  category: string;
}

export interface CalfDetail {
  id: string;
  name: string | null;
  tagNumber: string;
  birthDate: string;
  ageDays: number;
  gender: CalfGender;
  dam: CalfDamRef | null;
  birthWeightKg: number | null;
  birthEaseScore: string | null;
  colostrumRecords: CalfColostrumRecord[];
  totalColostrum24hMl: number;
  milkFeedingLog: CalfMilkFeeding[];
  weightRecords: CalfWeightPoint[];
  starterFeed: CalfStarterFeedSummary;
  weaningTargetDate: string | null;
  weaningWeightTargetKg: number;
  weaningStatus: "weaned" | "pending";
  weaningRecord: CalfWeaningRecord | null;
  upcomingTasks: CalfUpcomingTask[];
}

// ---- POST /calves/:id/wean --------------------------------------------------

export interface WeanCalfResult {
  calfId: string;
  weaned: true;
  adgAtWeaning: number | null;
  // No longer auto-set on weaning (RAKHAL-269 dropped GROWING from
  // ProductionStatus) — backend always returns null now, kept as
  // `string | null` for API-shape parity.
  productionStatusUpdatedTo: string | null;
  movedToCattleModule: true;
  removedFromCalfManagement: true;
  weaningRecord: CalfWeaningRecord;
}
