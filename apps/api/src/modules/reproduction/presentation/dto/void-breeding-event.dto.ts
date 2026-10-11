import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimString } from './common.dto';

/**
 * Void a breeding / AI event that was recorded by mistake. `:id` comes from the route param, not the
 * body (RAKHAL convention). The reason is mandatory - it is the audit trail for why money and a straw
 * were reversed.
 */
export class VoidBreedingEventDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
