import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Body of `PATCH /cattle/:id/events/:eventId` (RAKHAL-488): the date and the note. */
export class EditEventDto {
  @IsOptional()
  @IsISO8601()
  eventAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/** Body of `POST /cattle/:id/events/:eventId/void`. */
export class VoidEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
