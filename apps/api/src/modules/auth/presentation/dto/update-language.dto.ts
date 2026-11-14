import { IsIn } from 'class-validator';
import type { AppLanguage } from 'src/common/i18n/language';

export class UpdateLanguageDto {
  @IsIn(['bn', 'en'])
  preferredLanguage!: AppLanguage;
}
