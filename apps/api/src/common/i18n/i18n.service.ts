import { Injectable } from '@nestjs/common';
import { AppLanguage } from './language';
import { commonEn } from './translations/common.en';
import { commonBn } from './translations/common.bn';
import { notificationEn } from './translations/notification.en';
import { notificationBn } from './translations/notification.bn';

const CATALOGUES: Record<AppLanguage, Record<string, unknown>> = {
  en: { common: commonEn, notification: notificationEn },
  bn: { common: commonBn, notification: notificationBn },
};

type Params = Record<string, string | number>;

/**
 * Hand-rolled translation lookup (RAKHAL-107) — no i18n library dependency,
 * mirroring the rest of the codebase's build-only-what's-needed seams (e.g.
 * `EmailTemplateService`'s plain string-replace over Handlebars). Dot-path
 * key into the nested catalogue, `{{token}}` interpolation, falls back to
 * English then to the raw key if a translation is missing.
 */
@Injectable()
export class I18nService {
  translate(lang: AppLanguage, key: string, params?: Params): string {
    const template =
      this.lookup(CATALOGUES[lang], key) ?? this.lookup(CATALOGUES.en, key);
    if (template === undefined) return key;
    return this.interpolate(template, params);
  }

  private lookup(
    catalogue: Record<string, unknown>,
    key: string,
  ): string | undefined {
    const value = key
      .split('.')
      .reduce<unknown>(
        (node, segment) =>
          node && typeof node === 'object'
            ? (node as Record<string, unknown>)[segment]
            : undefined,
        catalogue,
      );
    return typeof value === 'string' ? value : undefined;
  }

  private interpolate(template: string, params?: Params): string {
    if (!params) return template;
    return template.replace(/\{\{(\w+)\}\}/g, (match, token: string) =>
      token in params ? String(params[token]) : match,
    );
  }
}
