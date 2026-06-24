import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { MilkSession } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** Query for `GET /milk/overview`. */
export class MilkOverviewQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}

/** Query for `GET /milk/log`. */
export class MilkLogQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  shedId?: string;

  @IsOptional()
  @IsEnum(MilkSession)
  session?: MilkSession;
}

/** Query for `GET /milk/anomalies`. */
export class MilkAnomalyQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}
