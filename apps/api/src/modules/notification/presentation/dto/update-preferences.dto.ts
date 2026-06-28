import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class QuietHoursDto {
  @Matches(HHMM, { message: 'start must be HH:mm' })
  start!: string;

  @Matches(HHMM, { message: 'end must be HH:mm' })
  end!: string;
}

export class PreferenceChannelsDto {
  @IsBoolean() in_app!: boolean;
  @IsBoolean() sms!: boolean;
  @IsBoolean() whatsapp!: boolean;
  @IsBoolean() email!: boolean;
}

export class PreferenceItemDto {
  @IsString()
  event_key!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => PreferenceChannelsDto)
  channels?: PreferenceChannelsDto;
}

/** `PATCH /notifications/preferences` — set quiet hours and/or per-event channel prefs. */
export class UpdatePreferencesDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => QuietHoursDto)
  quiet_hours?: QuietHoursDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreferenceItemDto)
  preferences?: PreferenceItemDto[];
}
