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
var OtpService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const env_1 = require("src/core/config/env");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const otp_delivery_channel_port_1 = require("../ports/otp-delivery-channel.port");
let OtpService = OtpService_1 = class OtpService {
    prisma;
    channel;
    log;
    ttl = env_1.env.OTP_TTL_SECONDS;
    maxAttempts = env_1.env.OTP_MAX_ATTEMPTS;
    cooldown = env_1.env.OTP_RESEND_COOLDOWN_SECONDS;
    constructor(prisma, channel, logger) {
        this.prisma = prisma;
        this.channel = channel;
        this.log = logger.setContext(OtpService_1.name);
    }
    hash(code) {
        return (0, node_crypto_1.createHash)('sha256').update(code).digest('hex');
    }
    async request(userId, purpose) {
        const recent = await this.prisma.otpChallenge.findFirst({
            where: {
                userId,
                purpose,
                consumedAt: null,
                createdAt: { gt: new Date(Date.now() - this.cooldown * 1000) },
            },
        });
        if (recent) {
            throw new common_1.BadRequestException('Please wait before requesting another code');
        }
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, name: true, preferredLanguage: true },
        });
        if (!user)
            throw new common_1.BadRequestException('User not found');
        const code = String((0, node_crypto_1.randomInt)(0, 1_000_000)).padStart(6, '0');
        await this.prisma.$transaction([
            this.prisma.otpChallenge.updateMany({
                where: { userId, purpose, consumedAt: null },
                data: { consumedAt: new Date() },
            }),
            this.prisma.otpChallenge.create({
                data: {
                    userId,
                    purpose,
                    codeHash: this.hash(code),
                    expiresAt: new Date(Date.now() + this.ttl * 1000),
                },
            }),
        ]);
        await this.channel.send({
            userId,
            email: user.email,
            name: user.name,
            code,
            purpose,
            ttlSeconds: this.ttl,
            locale: user.preferredLanguage.toLowerCase(),
        });
        this.log.info('OTP requested', {
            userId,
            purpose,
            channel: this.channel.channel,
        });
        return {
            sent: true,
            channel: this.channel.channel,
            expires_in_seconds: this.ttl,
            ...(env_1.env.NODE_ENV !== 'production' ? { code } : {}),
        };
    }
    async verify(userId, purpose, code) {
        const challenge = await this.prisma.otpChallenge.findFirst({
            where: { userId, purpose, consumedAt: null },
            orderBy: { createdAt: 'desc' },
        });
        if (!challenge || challenge.expiresAt < new Date()) {
            throw new common_1.BadRequestException('Invalid or expired code');
        }
        if (challenge.attempts >= this.maxAttempts) {
            await this.prisma.otpChallenge.update({
                where: { id: challenge.id },
                data: { consumedAt: new Date() },
            });
            throw new common_1.BadRequestException('Too many attempts — request a new code');
        }
        if (this.hash(code) !== challenge.codeHash) {
            await this.prisma.otpChallenge.update({
                where: { id: challenge.id },
                data: { attempts: { increment: 1 } },
            });
            throw new common_1.BadRequestException('Invalid or expired code');
        }
        await this.prisma.$transaction([
            this.prisma.otpChallenge.update({
                where: { id: challenge.id },
                data: { consumedAt: new Date() },
            }),
            this.prisma.user.update({
                where: { id: userId },
                data: { phoneVerifiedAt: new Date() },
            }),
        ]);
        this.log.info('OTP verified — account marked verified', {
            userId,
            purpose,
        });
    }
};
exports.OtpService = OtpService;
exports.OtpService = OtpService = OtpService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(otp_delivery_channel_port_1.OTP_DELIVERY_CHANNEL)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, Object, logger_service_1.LoggerService])
], OtpService);
//# sourceMappingURL=otp.service.js.map