import { AppLanguage } from './language';
type Params = Record<string, string | number>;
export declare class I18nService {
    translate(lang: AppLanguage, key: string, params?: Params): string;
    private lookup;
    private interpolate;
}
export {};
