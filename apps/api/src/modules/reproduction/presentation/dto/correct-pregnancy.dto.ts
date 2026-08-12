import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';
import { trimString } from './common.dto';

/** RAKHAL-325: `:id` comes from the route param, not the body. `reason` is
 * required — an explicit "this was a mistake" needs a real explanation, not
 * a silent status flip. */
export class CorrectPregnancyDto {
  @Transform(trimString)
  @IsString()
  @MinLength(3)
  reason!: string;
}
