import { type ReportErrorCategory } from './contracts/enums';
export declare class ReportError extends Error {
    readonly category: ReportErrorCategory;
    constructor(category: ReportErrorCategory, message: string);
    get transient(): boolean;
}
