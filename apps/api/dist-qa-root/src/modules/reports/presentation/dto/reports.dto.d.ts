import { CursorPaginationQueryDto } from 'src/common/pagination';
import { type DatePreset, type ReportOrigin, type ReportScopeKind, type ReportStatus, type ReportType } from '../../domain/contracts/enums';
export declare class ReportPeriodDto {
    preset: DatePreset;
    customStartDate?: string;
    customEndDate?: string;
}
export declare class ReportScopeDto {
    kind: ReportScopeKind;
    cattleId?: string;
    groupId?: string;
}
export declare class PreviewReportDto {
    templateId: string;
    period: ReportPeriodDto;
    scope: ReportScopeDto;
    selectedMetricIds: string[];
    compare?: boolean;
}
export declare class CreateReportDto extends PreviewReportDto {
    forceNew?: boolean;
}
export declare class ListReportsQueryDto extends CursorPaginationQueryDto {
    type?: ReportType;
    origin?: ReportOrigin;
    status?: ReportStatus;
}
export declare class ReportIdParamDto {
    id: string;
}
