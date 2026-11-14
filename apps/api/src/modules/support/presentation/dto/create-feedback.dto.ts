import { Transform } from 'class-transformer';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { SupportCategory } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** `POST /feedback` body (RAKHAL-242). Multipart — an optional `file` screenshot rides alongside. */
export class CreateFeedbackDto {
  @IsEnum(SupportCategory)
  category!: SupportCategory;

  @Transform(trimString)
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  message!: string;
}
