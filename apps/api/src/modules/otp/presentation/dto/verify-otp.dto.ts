import { IsNotEmpty, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import { trimString } from 'src/common/dto';

export class VerifyOtpDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code!: string;
}
