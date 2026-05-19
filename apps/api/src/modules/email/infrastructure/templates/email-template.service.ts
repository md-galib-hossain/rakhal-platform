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
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        html = html.replaceAll(`{{${key}}}`, String(value));
        continue;
      }

      if (value == null) {
        html = html.replaceAll(`{{${key}}}`, '');
        continue;
      }

      html = html.replaceAll(`{{${key}}}`, JSON.stringify(value));
    }

    return html;
  }
}
