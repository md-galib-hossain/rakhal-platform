import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { FeedTargetType } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** `POST /feed/quick-feed` — feed a single raw inventory item (grass, silage) straight to a
 * cow/group/herd, no `FeedConcentration` involved (2026-08-13, user request — "single items
 * like grass or silage... own lightweight path, not a fake 1-ingredient Concentration").
 * Fed-and-logged in one step: no plan/actual gap, `plannedKg` always equals `actualKg`. */
export class QuickFeedDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  feedItemId!: string;

  @IsNumber()
  @Min(0.01)
  quantityKg!: number;

  @IsEnum(FeedTargetType)
  targetType!: FeedTargetType;

  @ValidateIf((o: QuickFeedDto) => o.targetType === 'GROUP')
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  feedGroupId?: string;

  @ValidateIf((o: QuickFeedDto) => o.targetType === 'INDIVIDUAL')
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  cattleId?: string;

  /** Distribution date (YYYY-MM-DD); defaults to today. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'distributedAt must be YYYY-MM-DD',
  })
  distributedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimString)
  notes?: string;
}
