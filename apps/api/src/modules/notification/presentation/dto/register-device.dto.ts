import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimString } from 'src/common/dto';

/** `POST /notifications/devices` — register this device's push token (FCM). */
export class RegisterDeviceDto {
  @Transform(trimString)
  @IsString()
  @MinLength(10)
  @MaxLength(4096)
  token!: string;

  @IsIn(['android', 'ios', 'web'])
  platform!: 'android' | 'ios' | 'web';

  /** Delivery provider for the token; defaults to `fcm`. */
  @IsOptional()
  @IsIn(['fcm'])
  provider?: 'fcm';
}
