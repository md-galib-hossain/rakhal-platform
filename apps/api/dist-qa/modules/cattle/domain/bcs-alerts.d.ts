export interface BcsAlert {
    level: 'orange' | 'yellow';
    code: string;
    message: string;
}
export interface BcsAlertInput {
    score: number;
    recordedDate: Date;
    expectedCalvingDate?: Date | null;
    priorScore?: number | null;
}
export declare function computeBcsAlerts(input: BcsAlertInput): BcsAlert[];
