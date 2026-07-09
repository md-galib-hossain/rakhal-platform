/** Supported app locales (RAKHAL-107). Bangla-first — see {@link DEFAULT_LANGUAGE}. */
export type AppLanguage = 'bn' | 'en';

/** Worker-facing screens default to Bangla (PRD §1.4/§23.1) when no signal says otherwise. */
export const DEFAULT_LANGUAGE: AppLanguage = 'bn';

const SUPPORTED_LANGUAGES: readonly AppLanguage[] = ['bn', 'en'];

export function isAppLanguage(value: unknown): value is AppLanguage {
  return (
    typeof value === 'string' &&
    SUPPORTED_LANGUAGES.includes(value as AppLanguage)
  );
}

/**
 * Resolve the effective request language: an explicit `Accept-Language`
 * override wins (first supported tag in the header's preference order), else
 * the user's stored `preferredLanguage`, else {@link DEFAULT_LANGUAGE}.
 */
export function resolveLanguage(
  acceptLanguageHeader: string | string[] | undefined,
  preferredLanguage?: AppLanguage | null,
): AppLanguage {
  const fromHeader = parseAcceptLanguage(acceptLanguageHeader);
  if (fromHeader) return fromHeader;
  if (preferredLanguage && isAppLanguage(preferredLanguage)) {
    return preferredLanguage;
  }
  return DEFAULT_LANGUAGE;
}

function parseAcceptLanguage(
  header: string | string[] | undefined,
): AppLanguage | undefined {
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return undefined;

  // "bn-BD,bn;q=0.9,en;q=0.8" → sorted by q, primary subtag lower-cased.
  const tags = raw
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const q = qParam ? Number(qParam.trim().slice(2)) : 1;
      return { primary: tag.trim().split('-')[0].toLowerCase(), q };
    })
    .sort((a, b) => b.q - a.q);

  for (const { primary } of tags) {
    if (isAppLanguage(primary)) return primary;
  }
  return undefined;
}
