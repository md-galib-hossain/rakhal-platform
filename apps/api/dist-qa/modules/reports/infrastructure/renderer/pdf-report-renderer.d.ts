import type { ObjectStoragePort } from 'src/modules/media/application/ports/object-storage.port';
import type { ReportSnapshotPayload } from '../../domain/contracts/snapshot';
import type { ReportRenderer } from '../../application/ports/report-ports';
export declare const LOGO_MAX_BYTES: number;
export declare function sniffImage(buf: Buffer): 'png' | 'jpeg' | null;
export declare class PdfReportRenderer implements ReportRenderer {
    private readonly storage?;
    constructor(storage?: ObjectStoragePort | undefined);
    render(payload: ReportSnapshotPayload): Promise<{
        body: Buffer;
        contentType: string;
    }>;
    private loadLogo;
}
