"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.I18nService = void 0;
const common_1 = require("@nestjs/common");
const common_en_1 = require("./translations/common.en");
const common_bn_1 = require("./translations/common.bn");
const notification_en_1 = require("./translations/notification.en");
const notification_bn_1 = require("./translations/notification.bn");
const CATALOGUES = {
    en: { common: common_en_1.commonEn, notification: notification_en_1.notificationEn },
    bn: { common: common_bn_1.commonBn, notification: notification_bn_1.notificationBn },
};
let I18nService = class I18nService {
    translate(lang, key, params) {
        const template = this.lookup(CATALOGUES[lang], key) ?? this.lookup(CATALOGUES.en, key);
        if (template === undefined)
            return key;
        return this.interpolate(template, params);
    }
    lookup(catalogue, key) {
        const value = key
            .split('.')
            .reduce((node, segment) => node && typeof node === 'object'
            ? node[segment]
            : undefined, catalogue);
        return typeof value === 'string' ? value : undefined;
    }
    interpolate(template, params) {
        if (!params)
            return template;
        return template.replace(/\{\{(\w+)\}\}/g, (match, token) => token in params ? String(params[token]) : match);
    }
};
exports.I18nService = I18nService;
exports.I18nService = I18nService = __decorate([
    (0, common_1.Injectable)()
], I18nService);
//# sourceMappingURL=i18n.service.js.map