"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfReportRenderer = exports.LOGO_MAX_BYTES = void 0;
exports.sniffImage = sniffImage;
const common_1 = require("@nestjs/common");
const object_storage_port_1 = require("src/modules/media/application/ports/object-storage.port");
const report_error_1 = require("../../domain/report-error");
const report_layout_1 = require("./report-layout");
const pdf_document_writer_1 = require("./pdf-document-writer");
const logo_guard_1 = require("./logo-guard");
exports.LOGO_MAX_BYTES = 1024 * 1024;
const LOGO_TIMEOUT_MS = 3000;
function sniffImage(buf) {
    if (buf.length > 8 &&
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47) {
        return 'png';
    }
    if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
        return 'jpeg';
    }
    return null;
}
let PdfReportRenderer = class PdfReportRenderer {
    storage;
    constructor(storage) {
        this.storage = storage;
    }
    async render(payload) {
        try {
            const layout = (0, report_layout_1.buildReportLayout)(payload);
            const logo = await this.loadLogo(payload.farm.logoKey, payload.farm.id);
            const created = new Date(payload.generatedAt);
            const body = await new pdf_document_writer_1.PdfDocumentWriter(layout).write({
                logo,
                createdAt: Number.isNaN(created.getTime()) ? new Date(0) : created,
            });
            return { body, contentType: 'application/pdf' };
        }
        catch (e) {
            if (e instanceof report_error_1.ReportError)
                throw e;
            throw new report_error_1.ReportError('RENDER_FAILED', 'The report PDF could not be rendered.');
        }
    }
    async loadLogo(key, farmId) {
        if (!key || !this.storage)
            return undefined;
        if (!(0, logo_guard_1.isFarmOwnedKey)(key, farmId))
            return undefined;
        let timer;
        try {
            const buf = await Promise.race([
                this.storage.get(key, { maxBytes: exports.LOGO_MAX_BYTES }),
                new Promise((_, rej) => {
                    timer = setTimeout(() => rej(new Error('timeout')), LOGO_TIMEOUT_MS);
                }),
            ]);
            if (!Buffer.isBuffer(buf) ||
                buf.length === 0 ||
                buf.length > exports.LOGO_MAX_BYTES)
                return undefined;
            if (!sniffImage(buf) || !(0, logo_guard_1.isSafeImageSize)(buf))
                return undefined;
            return buf;
        }
        catch {
            return undefined;
        }
        finally {
            if (timer)
                clearTimeout(timer);
        }
    }
};
exports.PdfReportRenderer = PdfReportRenderer;
exports.PdfReportRenderer = PdfReportRenderer = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(0, (0, common_1.Inject)(object_storage_port_1.OBJECT_STORAGE)),
    __metadata("design:paramtypes", [Object])
], PdfReportRenderer);
//# sourceMappingURL=pdf-report-renderer.js.map