"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailTemplateService = void 0;
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const path_1 = require("path");
const TEMPLATES_DIR = (0, path_1.join)(process.cwd(), 'src', 'modules', 'email', 'infrastructure', 'templates', 'files');
let EmailTemplateService = class EmailTemplateService {
    render(template, data, locale = 'en') {
        const base = template.toLowerCase();
        const localizedPath = (0, path_1.join)(TEMPLATES_DIR, `${base}.${locale}.html`);
        const templatePath = (0, fs_1.existsSync)(localizedPath)
            ? localizedPath
            : (0, path_1.join)(TEMPLATES_DIR, `${base}.html`);
        let html = (0, fs_1.readFileSync)(templatePath, 'utf-8');
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'string' ||
                typeof value === 'number' ||
                typeof value === 'boolean') {
                html = html.replaceAll(`{{${key}}}`, String(value));
                continue;
            }
            if (value == null) {
                html = html.replaceAll(`{{${key}}}`, '');
                continue;
            }
            html = html.replaceAll(`{{${key}}}`, JSON.stringify(value));
        }
        return html;
    }
};
exports.EmailTemplateService = EmailTemplateService;
exports.EmailTemplateService = EmailTemplateService = __decorate([
    (0, common_1.Injectable)()
], EmailTemplateService);
//# sourceMappingURL=email-template.service.js.map