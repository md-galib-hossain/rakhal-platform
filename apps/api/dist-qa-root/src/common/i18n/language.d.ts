export type AppLanguage = 'bn' | 'en';
export declare const DEFAULT_LANGUAGE: AppLanguage;
export declare function isAppLanguage(value: unknown): value is AppLanguage;
export declare function resolveLanguage(acceptLanguageHeader: string | string[] | undefined, preferredLanguage?: AppLanguage | null): AppLanguage;
