import { EmailTemplate } from '../../domain/enums/email-template.enum';
import { AppLanguage } from 'src/common/i18n/language';
export declare class EmailTemplateService {
    render(template: EmailTemplate, data: Record<string, unknown>, locale?: AppLanguage): string;
}
