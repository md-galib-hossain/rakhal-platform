import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { EmailTemplate } from '../../domain/enums/email-template.enum';

@Injectable()
export class EmailTemplateService {
  render(template: EmailTemplate, data: Record<string, unknown>): string {
    const templatePath = join(
      process.cwd(),
      'src',
      'modules',
      'email',
      'infrastructure',
      'templates',
      'files',
      `${template.toLowerCase()}.html`,
    );

    let html = readFileSync(templatePath, 'utf-8');
    for (const [key, value] of Object.entries(data)) {
      html = html.replaceAll(`{{${key}}}`, String(value ?? ''));
    }

    return html;
  }
}
