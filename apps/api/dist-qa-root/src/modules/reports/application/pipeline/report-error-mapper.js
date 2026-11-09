"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toReportError = toReportError;
const client_1 = require("@prisma/client");
const report_error_1 = require("../../domain/report-error");
const report_pipeline_constants_1 = require("./report-pipeline.constants");
function toReportError(err, phase) {
    if (err instanceof report_error_1.ReportError)
        return err;
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError ||
        err instanceof client_1.Prisma.PrismaClientInitializationError ||
        err instanceof client_1.Prisma.PrismaClientRustPanicError ||
        err instanceof client_1.Prisma.PrismaClientUnknownRequestError) {
        return new report_error_1.ReportError('DB_TIMEOUT', report_pipeline_constants_1.SAFE_ERROR_MESSAGE.DB_TIMEOUT);
    }
    if (phase === 'storage') {
        return new report_error_1.ReportError('STORAGE_UNAVAILABLE', report_pipeline_constants_1.SAFE_ERROR_MESSAGE.STORAGE_UNAVAILABLE);
    }
    if (phase === 'render') {
        return new report_error_1.ReportError('RENDER_FAILED', report_pipeline_constants_1.SAFE_ERROR_MESSAGE.RENDER_FAILED);
    }
    return new report_error_1.ReportError('GENERATION_FAILED', report_pipeline_constants_1.SAFE_ERROR_MESSAGE.GENERATION_FAILED);
}
//# sourceMappingURL=report-error-mapper.js.map