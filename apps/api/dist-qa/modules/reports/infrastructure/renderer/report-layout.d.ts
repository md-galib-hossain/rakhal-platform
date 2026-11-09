import { type ReportSnapshotPayload } from '../../domain/contracts/snapshot';
import type { ReportPeriod } from '../../domain/contracts/period';
import { type DeltaText } from './report-format';
export type ReportKind = 'weekly' | 'monthly' | 'snapshot';
export interface KpiCard {
    id: string;
    label: string;
    valueText: string;
    unitText: string;
    state: 'value' | 'missing' | 'not_calculated' | 'not_applicable';
    detail?: string;
    delta?: DeltaText;
    sourceLabel?: string;
}
export interface TableColumn {
    label: string;
    align: 'left' | 'right';
    weight: number;
}
export interface TableSpec {
    columns: TableColumn[];
    rows: string[][];
    note?: string;
    repeatHeader: true;
    minRowsBeforeBreak: number;
    avoidOrphanRows: number;
}
export interface ChartPoint {
    label: string;
    value: number | null;
    text: string;
}
export interface RankedRow {
    rank: number;
    label: string;
    value: number;
    text: string;
}
export type LayoutBlock = {
    type: 'hero';
    eyebrow: string;
    valueText: string;
    unitText: string;
    state: KpiCard['state'];
    delta?: DeltaText;
    caption?: string;
    sideLabel: string;
    sideLines: string[];
} | {
    type: 'section';
    title: string;
    subtitle?: string;
} | {
    type: 'kpis';
    cards: KpiCard[];
} | {
    type: 'line' | 'bar';
    title: string;
    unitLabel: string;
    points: ChartPoint[];
    footnote?: string;
} | {
    type: 'donut';
    title: string;
    centerText: string;
    centerCaption: string;
    slices: {
        label: string;
        value: number;
        text: string;
    }[];
    footnote?: string;
} | {
    type: 'ranked';
    title: string;
    unitLabel: string;
    rows: RankedRow[];
    footnote?: string;
    table?: TableSpec;
} | {
    type: 'table';
    title: string;
    table: TableSpec;
} | {
    type: 'exceptions';
    title: string;
    items: {
        text: string;
        detail?: string;
    }[];
} | {
    type: 'notice';
    tone: 'restricted' | 'info';
    title: string;
    text: string;
} | {
    type: 'dataQuality';
    title: string;
    coverage?: string;
    rules: string[];
    notes: string[];
};
export interface ReportLayout {
    kind: ReportKind;
    title: string;
    eyebrow: string;
    headerRight: string[];
    farmName: string;
    meta: {
        label: string;
        value: string;
    }[];
    footerLabel: string;
    blocks: LayoutBlock[];
}
export declare const TOP_N = 10;
export declare const DONUT_MAX_SLICES = 8;
export declare const MAX_TABLE_ROWS = 5000;
export declare function detectKind(period: ReportPeriod): ReportKind;
export declare function buildReportLayout(payload: ReportSnapshotPayload): ReportLayout;
