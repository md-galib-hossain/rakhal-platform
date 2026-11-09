export type Cell = string | number | null;
export interface ReceiptSummaryItem {
    label: string;
    value: string | number;
}
export interface ReceiptSection {
    heading: string;
    summary?: ReceiptSummaryItem[];
    columns: string[];
    rows: Cell[][];
}
export interface ReceiptReportData {
    title: string;
    period?: string;
    summary?: ReceiptSummaryItem[];
    columns: string[];
    rows: Cell[][];
    sections?: ReceiptSection[];
}
export declare function renderReceiptPdf(report: ReceiptReportData): Promise<Buffer>;
