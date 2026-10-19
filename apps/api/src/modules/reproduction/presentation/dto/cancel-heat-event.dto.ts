import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { trimString } from './common.dto';

/**
 * Cancel (remove) a heat that was recorded by mistake. `:id` comes from the route param, not the body.
 * The reason is optional - a heat carries no money or stock, so it is only an audit note.
 */
export class CancelHeatEventDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  reason?: string;
}
