import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { trimString } from 'src/common/dto';

/** One shed in the onboarding "configure" step (PRD §5.1 Step 3). */
class OnboardingShedDto {
  @IsString()
  @MaxLength(80)
  @Transform(trimString)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  capacity?: number;

  /** Free-text purpose (e.g. "milking"/"dry"); mapped to ShedPurpose, defaults GENERAL. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(trimString)
  purpose?: string;
}

/** `POST /onboarding/configure` (RAKHAL-022). Creates sheds + sets milk sessions. */
export class ConfigureOnboardingDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => OnboardingShedDto)
  sheds?: OnboardingShedDto[];

  @IsOptional()
  @IsArray()
  @IsIn(['morning', 'noon', 'evening', 'night'], { each: true })
  active_sessions?: string[];

  @IsOptional()
  @IsIn(['litres', 'kg'])
  milk_unit?: string;
}
