import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { toBoolean, trimString } from 'src/common/dto';

/** Confirm a previewed milk log import. `POST /milk/import/confirm`. */
export class ImportMilkConfirmDto {
  @Transform(trimString)
  @IsString()
  importSessionId!: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  skipErrors = false;
}
