import { Inject, Injectable, Optional } from '@nestjs/common';
import { OBJECT_STORAGE } from 'src/modules/media/application/ports/object-storage.port';
import type { ObjectStoragePort } from 'src/modules/media/application/ports/object-storage.port';
import type { ReportSnapshotPayload } from '../../domain/contracts/snapshot';
import type { ReportRenderer } from '../../application/ports/report-ports';
import { ReportError } from '../../domain/report-error';
import { buildReportLayout } from './report-layout';
import { PdfDocumentWriter } from './pdf-document-writer';
import { isFarmOwnedKey, isSafeImageSize } from './logo-guard';

export const LOGO_MAX_BYTES = 1024 * 1024;
const LOGO_TIMEOUT_MS = 3000;

/** Returns 'png' | 'jpeg' from the magic bytes, or null. */
export function sniffImage(buf: Buffer): 'png' | 'jpeg' | null {
  if (
    buf.length > 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return 'png';
  }
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'jpeg';
  }
  return null;
}

/**
 * Renders the stored snapshot to a PDF (pdfkit). Reads nothing but the payload (plus the optional
 * farm logo from object storage); never touches the database.
 */
@Injectable()
export class PdfReportRenderer implements ReportRenderer {
  constructor(
    @Optional()
    @Inject(OBJECT_STORAGE)
    private readonly storage?: ObjectStoragePort,
  ) {}

  async render(
    payload: ReportSnapshotPayload,
  ): Promise<{ body: Buffer; contentType: string }> {
    try {
      const layout = buildReportLayout(payload);
      const logo = await this.loadLogo(payload.farm.logoKey, payload.farm.id);
      const created = new Date(payload.generatedAt);
      const body = await new PdfDocumentWriter(layout).write({
        logo,
        createdAt: Number.isNaN(created.getTime()) ? new Date(0) : created,
      });
      return { body, contentType: 'application/pdf' };
    } catch (e) {
      if (e instanceof ReportError) throw e;
      throw new ReportError(
        'RENDER_FAILED',
        'The report PDF could not be rendered.',
      );
    }
  }

  /** Any failure (no key, storage error, too big, not png/jpeg, timeout) means no logo. */
  private async loadLogo(
    key: string | null | undefined,
    farmId: string | null | undefined,
  ): Promise<Buffer | undefined> {
    if (!key || !this.storage) return undefined;
    // Defence in depth: only ever fetch the farm's own keys, even if the payload was tampered with.
    if (!isFarmOwnedKey(key, farmId)) return undefined;
    let timer: NodeJS.Timeout | undefined;
    try {
      const buf = await Promise.race([
        this.storage.get(key, { maxBytes: LOGO_MAX_BYTES }),
        new Promise<never>((_, rej) => {
          timer = setTimeout(() => rej(new Error('timeout')), LOGO_TIMEOUT_MS);
        }),
      ]);
      if (
        !Buffer.isBuffer(buf) ||
        buf.length === 0 ||
        buf.length > LOGO_MAX_BYTES
      )
        return undefined;
      if (!sniffImage(buf) || !isSafeImageSize(buf)) return undefined;
      return buf;
    } catch {
      return undefined;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
