import type { ReportSnapshotPayload } from '../../domain/contracts/snapshot';
import type { ReportRenderer } from '../../application/ports/report-ports';
export declare class NullReportRenderer implements ReportRenderer {
    render(payload: ReportSnapshotPayload): Promise<{
        body: Buffer;
        contentType: string;
    } | null>;
}
