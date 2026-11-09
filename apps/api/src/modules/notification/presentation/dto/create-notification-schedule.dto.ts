import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { trimString } from 'src/common/dto';

export const SCHEDULE_TRIGGERS = [
  'DATE',
  'BEFORE_EVENT',
  'AFTER_EVENT',
] as const;
export const SCHEDULE_ANCHOR_TYPES = [
  'ANIMAL_EVENT',
  'TASK',
  'HEALTH_STEP',
] as const;
export const SCHEDULE_REPEAT_TYPES = [
  'NEVER',
  'EVERY_N_DAYS',
  'WEEKLY',
  'MONTHLY',
] as const;
export const SCHEDULE_AUDIENCE_MODES = ['USER', 'ROLES', 'USERS'] as const;

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ScheduleAnchorDto {
  @IsIn(SCHEDULE_ANCHOR_TYPES)
  type!: (typeof SCHEDULE_ANCHOR_TYPES)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  id!: string;
}

export class ScheduleRepeatDto {
  @IsIn(SCHEDULE_REPEAT_TYPES)
  type!: (typeof SCHEDULE_REPEAT_TYPES)[number];

  /** EVERY_N_DAYS only (1..365; range re-checked by the domain). */
  @IsOptional()
  @IsInt()
  interval?: number;

  /** Inclusive farm-local `YYYY-MM-DD`. */
  @IsOptional()
  @Matches(YMD)
  end_date?: string;
}

export class ScheduleAudienceDto {
  @IsIn(SCHEDULE_AUDIENCE_MODES)
  mode!: (typeof SCHEDULE_AUDIENCE_MODES)[number];

  /** mode USER. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  user_id?: string;

  /** mode ROLES. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  roles?: string[];

  /** mode USERS (max 100, re-checked by the domain). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(101)
  @IsString({ each: true })
  user_ids?: string[];
}

/**
 * `POST /notifications/schedules` and `/preview` body (docs/EPIC_NOTIFICATIONS_V2.md §4). Dates and times are
 * farm-local strings, never UTC instants; `farmId` is never accepted.
 */
export class CreateNotificationScheduleDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(1000)
  body?: string;

  @IsIn(SCHEDULE_TRIGGERS)
  trigger!: (typeof SCHEDULE_TRIGGERS)[number];

  /** Farm-local `YYYY-MM-DD`; required for DATE, ignored otherwise. */
  @IsOptional()
  @Matches(YMD)
  date?: string;

  /** Farm-local `HH:mm`. With a time the notice is timed (exact minute); without, it is an all-day notice (08:00). */
  @IsOptional()
  @Matches(HM)
  time?: string;

  /** BEFORE_EVENT / AFTER_EVENT only. */
  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleAnchorDto)
  anchor?: ScheduleAnchorDto;

  /** BEFORE_EVENT / AFTER_EVENT only: distance in days, 0..3650. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  offset_days?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleRepeatDto)
  repeat?: ScheduleRepeatDto;

  /** Minutes before the anchor to fire (max 4, each <= 90 days; whole days when all-day). Default `[0]`. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsInt({ each: true })
  lead_minutes?: number[];

  @ValidateNested()
  @Type(() => ScheduleAudienceDto)
  audience!: ScheduleAudienceDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  animal_ids?: string[];
}
