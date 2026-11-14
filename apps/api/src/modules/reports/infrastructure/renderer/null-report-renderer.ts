import { Injectable } from '@nestjs/common';
import type { ReportSnapshotPayload } from '../../domain/contracts/snapshot';
import type { ReportRenderer } from '../../application/ports/report-ports';

/** Default renderer until the PDF renderer (RPT-11) is bound: no artifact, the report still completes. */
@Injectable()
export class NullReportRenderer implements ReportRenderer {
  render(
    payload: ReportSnapshotPayload,
  ): Promise<{ body: Buffer; contentType: string } | null> {
    void payload;
    return Promise.resolve(null);
  }
}
