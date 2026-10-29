import {
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  ANIMAL_EVENT_TYPES,
  type AnimalEventTypeKey,
} from '../../domain/catalogue';

/** Body of `POST /cattle/:id/events` (RAKHAL-481). No `farmId`, no `cattleId`. */
export class RecordEventDto {
  @IsIn(ANIMAL_EVENT_TYPES)
  type!: AnimalEventTypeKey;

  /** When it happened (ISO 8601). Past dates are allowed; future dates are not. */
  @IsISO8601()
  eventAt!: string;

  /** Defaults to HISTORICAL when `eventAt` is more than 7 days ago, else RECORDED. */
  @IsOptional()
  @IsIn(['RECORDED', 'HISTORICAL'])
  provenance?: 'RECORDED' | 'HISTORICAL';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  /** Optional link, e.g. a preg check -> the AI it checks. */
  @IsOptional()
  @IsString()
  sourceEventId?: string;

  /** Type-specific fields (same names as the legacy route's body, minus cattle id and date). */
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
