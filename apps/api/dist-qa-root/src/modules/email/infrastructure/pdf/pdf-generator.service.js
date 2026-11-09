"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfGeneratorService = void 0;
const common_1 = require("@nestjs/common");
const pdfkit_1 = __importDefault(require("pdfkit"));
let PdfGeneratorService = class PdfGeneratorService {
    async generateReportPdf(input) {
        return new Promise((resolve, reject) => {
            const doc = new pdfkit_1.default({ size: 'A4', margin: 40 });
            const chunks = [];
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);
            doc.fontSize(16).text(input.title);
            doc.moveDown();
            for (const line of input.lines) {
                doc.fontSize(11).text(line);
            }
            doc.end();
        });
    }
};
exports.PdfGeneratorService = PdfGeneratorService;
exports.PdfGeneratorService = PdfGeneratorService = __decorate([
    (0, common_1.Injectable)()
], PdfGeneratorService);
//# sourceMappingURL=pdf-generator.service.js.map