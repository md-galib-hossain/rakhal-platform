import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { EmailTemplate } from '../../domain/enums/email-template.enum';
import { AppLanguage } from 'src/common/i18n/language';

const TEMPLATES_DIR = join(
  process.cwd(),
  'src',
  'modules',
  'email',
  'infrastructure',
  'templates',
  'files',
);

@Injectable()
export class EmailTemplateService {
  /**
   * `locale` (RAKHAL-107) picks `<template>.<locale>.html` when it exists,
   * falling back to the base English `<template>.html` — so adding a Bangla
   * variant for any template is just dropping in a new file, no code change.
   */
  render(
    template: EmailTemplate,
    data: Record<string, unknown>,
    locale: AppLanguage = 'en',
  ): string {
    const base = template.toLowerCase();
    const localizedPath = join(TEMPLATES_DIR, `${base}.${locale}.html`);
    const templatePath = existsSync(localizedPath)
      ? localizedPath
      : join(TEMPLATES_DIR, `${base}.html`);

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
