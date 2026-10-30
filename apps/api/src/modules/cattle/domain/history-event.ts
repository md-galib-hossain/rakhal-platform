import { BreedingMethod } from '@prisma/client';
import type { AnimalEventTypeKey } from 'src/modules/animal-events/domain/catalogue';
import type { HistoryItemDto } from '../presentation/dto/intake.dto';

/** RAKHAL-483: the event a `history[]` item stands for, or null when it maps to intake fields instead. */
export function historyEvent(h: HistoryItemDto): {
  type: AnimalEventTypeKey;
  eventAt: string;
  payload: Record<string, unknown>;
} | null {
  const date = h.date ?? new Date().toISOString();
  switch (h.kind) {
    case 'LAST_CALVING':
      return {
        type: 'CALVING',
        eventAt: date,
        payload: {
          calvingEase: 'NORMAL',
          ...(h.calvingNumber ? { calvingNumber: h.calvingNumber } : {}),
        },
      };
    case 'LAST_BREEDING':
      return {
        type: 'BREEDING',
        eventAt: date,
        payload: {
          breedingMethod: h.method ?? BreedingMethod.AI,
          ...(h.bull ? { sireNameOrCode: h.bull } : {}),
        },
      };
    case 'PREGNANT':
      return {
        type: 'PREG_CHECK',
        eventAt: new Date().toISOString(),
        payload: {
          ...(h.expectedCalvingDate
            ? { expectedCalvingDate: h.expectedCalvingDate }
            : {}),
          ...(h.monthsPregnant ? { gestationDay: h.monthsPregnant * 30 } : {}),
        },
      };
    case 'LAST_VACCINATION':
      return {
        type: 'VACCINATION',
        eventAt: date,
        payload: {
          medicineName: h.product ?? 'vaccine',
          outsideInventory: true,
          doseAmount: 1,
          doseUnit: 'dose',
          route: 'SC',
        },
      };
    default:
      return null; // MILKING_SINCE / DRY_SINCE map onto intake fields
  }
}
