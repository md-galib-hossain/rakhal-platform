"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const env_1 = require("src/core/config/env");
const auth_module_1 = require("../auth/auth.module");
const email_module_1 = require("../email/email.module");
const otp_service_1 = require("./application/services/otp.service");
const email_otp_channel_1 = require("./application/channels/email-otp.channel");
const otp_delivery_channel_port_1 = require("./application/ports/otp-delivery-channel.port");
const otp_controller_1 = require("./presentation/controllers/otp.controller");
let OtpModule = class OtpModule {
};
exports.OtpModule = OtpModule;
exports.OtpModule = OtpModule = __decorate([
    (0, common_1.Module)({
        imports: [logger_module_1.LoggerModule, auth_module_1.AuthModule, email_module_1.EmailModule],
        controllers: [otp_controller_1.OtpController],
        providers: [
            otp_service_1.OtpService,
            email_otp_channel_1.EmailOtpChannel,
            {
                provide: otp_delivery_channel_port_1.OTP_DELIVERY_CHANNEL,
                useFactory: (emailChannel) => {
                    if (env_1.env.OTP_CHANNEL === 'sms') {
                    }
                    return emailChannel;
                },
                inject: [email_otp_channel_1.EmailOtpChannel],
            },
        ],
        exports: [otp_service_1.OtpService],
    })
], OtpModule);
//# sourceMappingURL=otp.module.js.map