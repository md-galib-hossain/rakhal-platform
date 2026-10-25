import { Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimString } from 'src/common/dto';

export class AdminSendMessageDto {
  @Transform(trimString)
  @IsString()
  @MinLength(5, { message: 'Title must be at least 5 characters' })
  @MaxLength(100)
  title!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(10, { message: 'Message must be at least 10 characters' })
  @MaxLength(1000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  link?: string;

  @IsOptional()
  @IsIn(['all', 'telegram', 'push'])
  channel?: 'all' | 'telegram' | 'push';
}

export class AdminBroadcastMessageDto extends AdminSendMessageDto {
  @IsOptional()
  @IsIn(['all', 'owners', 'pro_plan', 'with_telegram'])
  targetAudience?: 'all' | 'owners' | 'pro_plan' | 'with_telegram';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetUserIds?: string[];
}
