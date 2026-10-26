import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  HealthActionType,
  HealthCareType,
  HealthCaseStatus,
  HealthCondition,
  HealthPlanCategory,
  HealthPlanType,
  HealthPriority,
  HealthTaskStatus,
  SafetyWithdrawalStatus,
} from '@prisma/client';
import { toBoolean } from 'src/common/dto';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { HealthListQueryDto, trimString } from './common.dto';

export class SickBayQueryDto extends HealthListQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  shed?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsEnum(HealthPriority)
  priority?: HealthPriority;

  @IsOptional()
  @IsEnum(HealthCaseStatus)
  status?: HealthCaseStatus;
}

export class TreatmentLogsQueryDto extends HealthListQueryDto {
  @IsOptional()
  @IsEnum(HealthCareType)
  careType?: HealthCareType;
}

/** RAKHAL-467 — `GET /health/outcomes?days=`: how far back to look (cases opened in the window). */
export class HealthOutcomesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(3650)
  days?: number;
}

/** `GET /health/morbidity-trend?days=` — omit `days` for all time. */
export class MorbidityTrendQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(3650)
  days?: number;
}

export class HealthPlanQueryDto extends HealthListQueryDto {
  @IsOptional()
  @IsEnum(HealthPlanCategory)
  category?: HealthPlanCategory;

  /** RAKHAL-468: only protocols for this structured condition. */
  @IsOptional()
  @IsEnum(HealthCondition)
  condition?: HealthCondition;

  @IsOptional()
  @IsEnum(HealthPlanType)
  planType?: HealthPlanType;

  /**
   * RFE-142: the protocol's one user-facing kind (EPIC D7), as the `stats.kind` each plan carries — `TREATMENT`,
   * `BREEDING`, or `PREVENTION` (= vaccination / deworming / prevention / routine). Lets the Protocols tab filter on the
   * server so a numbered pager never shows a page that the client then empties. Combined with `category` both apply.
   */
  @IsOptional()
  @IsIn(['TREATMENT', 'PREVENTION', 'BREEDING'])
  kind?: 'TREATMENT' | 'PREVENTION' | 'BREEDING';

  /**
   * RAKHAL-470: only protocols that currently have a run — an open case (treatment) or an active enrollment
   * (prevention / breeding). A protocol deleted while animals are still on it is **included** here (its `deletedAt` is
   * set), so a running protocol never disappears from the list just because someone archived its template.
   */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  inUse?: boolean;
}

/** RAKHAL-470 — `GET /health/plans/:id/runs`: the animals running one protocol. */
export class PlanRunsQueryDto extends CursorPaginationQueryDto {
  /** `active` (default) = open cases / active enrollments only; `all` adds finished ones. */
  @IsOptional()
  @IsIn(['active', 'all'])
  status: 'active' | 'all' = 'active';

  /** Animal tag number or name. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  search?: string;
}

export class HealthTaskQueryDto extends HealthListQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  date?: string;

  @IsOptional()
  @IsEnum(HealthTaskStatus)
  status?: HealthTaskStatus;

  /**
   * RAKHAL-470: several statuses at once, comma-separated (`PENDING,RESCHEDULED,OVERDUE` = "still to do"). Wins over
   * `status` when both are sent.
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @IsEnum(HealthTaskStatus, { each: true })
  statuses?: HealthTaskStatus[];

  /** RAKHAL-470: steps of one protocol. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  healthPlanId?: string;

  /** RAKHAL-470: only steps that belong to no protocol (`healthPlanId` null). Ignored when `healthPlanId` is set. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  noPlan?: boolean;

  /** RAKHAL-470: steps due up to and including this farm-local day (`YYYY-MM-DD`) — overdue ones included. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dueTo must be YYYY-MM-DD' })
  dueTo?: string;

  /** RAKHAL-470: `due` = soonest first (the order work is done in); default `created` = newest first (unchanged). */
  @IsOptional()
  @IsIn(['created', 'due'])
  sortBy?: 'created' | 'due';

  @IsOptional()
  @IsEnum(HealthActionType)
  type?: HealthActionType;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  healthCaseId?: string;
}

export class HealthTaskCalendarQueryDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(2000)
  year!: number;
}

export class SafetyWithdrawalQueryDto extends HealthListQueryDto {
  @IsOptional()
  @IsEnum(SafetyWithdrawalStatus)
  status?: SafetyWithdrawalStatus;

  /** RAKHAL-420: rows still withholding (ACTIVE or READY_FOR_RELEASE) — the milk-room question
   * ("who can't go in the tank today") in one request instead of the caller filtering client-side. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  activeOnly?: boolean;
}

export class AppliedPlansQueryDto extends HealthListQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  healthPlanId?: string;
}
