"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPORT_RENDERER_PROVIDERS = exports.NullReportRenderer = exports.buildReportLayout = exports.PdfReportRenderer = void 0;
const report_ports_1 = require("../../application/ports/report-ports");
const pdf_report_renderer_1 = require("./pdf-report-renderer");
var pdf_report_renderer_2 = require("./pdf-report-renderer");
Object.defineProperty(exports, "PdfReportRenderer", { enumerable: true, get: function () { return pdf_report_renderer_2.PdfReportRenderer; } });
var report_layout_1 = require("./report-layout");
Object.defineProperty(exports, "buildReportLayout", { enumerable: true, get: function () { return report_layout_1.buildReportLayout; } });
var null_report_renderer_1 = require("./null-report-renderer");
Object.defineProperty(exports, "NullReportRenderer", { enumerable: true, get: function () { return null_report_renderer_1.NullReportRenderer; } });
exports.REPORT_RENDERER_PROVIDERS = [
    { provide: report_ports_1.REPORT_RENDERER, useClass: pdf_report_renderer_1.PdfReportRenderer },
];
//# sourceMappingURL=index.js.map