import { IsDateString, IsEnum } from 'class-validator';
import { MilkSession } from '@prisma/client';

/** `POST /milk/submit` — finalize all logs for a session on a date. */
export class SubmitMilkDto {
  @IsDateString()
  date!: string;

  @IsEnum(MilkSession)
  session!: MilkSession;
}
