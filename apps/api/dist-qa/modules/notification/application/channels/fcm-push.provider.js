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
var FcmPushProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FcmPushProvider = void 0;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const fcmUrl = (projectId) => `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
let FcmPushProvider = FcmPushProvider_1 = class FcmPushProvider {
    prisma;
    channel = 'push';
    log;
    creds;
    accessToken = null;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.log = logger.setContext(FcmPushProvider_1.name);
        this.creds = this.loadCredentials();
    }
    isConfigured() {
        return this.creds !== null;
    }
    async send(msg) {
        if (!this.creds)
            return { delivered: false, detail: 'not_configured' };
        const devices = await this.prisma.deviceToken.findMany({
            where: { userId: msg.userId },
            select: { id: true, token: true },
        });
        if (devices.length === 0)
            return { delivered: false, detail: 'no_devices' };
        const token = await this.getAccessToken();
        if (!token)
            return { delivered: false, detail: 'auth_failed' };
        let success = 0;
        const stale = [];
        for (const device of devices) {
            const ok = await this.sendToToken(token, device.token, msg);
            if (ok === 'sent')
                success += 1;
            else if (ok === 'stale')
                stale.push(device.id);
        }
        if (stale.length > 0) {
            await this.prisma.deviceToken.deleteMany({
                where: { id: { in: stale } },
            });
        }
        return {
            delivered: success > 0,
            detail: `${success}/${devices.length} tokens`,
        };
    }
    async sendToToken(accessToken, deviceToken, msg) {
        try {
            const res = await fetch(fcmUrl(this.creds.project_id), {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: {
                        token: deviceToken,
                        notification: { title: msg.title, body: msg.message },
                        data: {
                            link: msg.link ?? '',
                            eventKey: msg.eventKey,
                            category: msg.category,
                            priority: msg.priority,
                        },
                        android: { priority: 'high' },
                    },
                }),
            });
            if (res.ok)
                return 'sent';
            const body = (await res.json().catch(() => ({})));
            const unregistered = body.error?.status === 'NOT_FOUND' ||
                body.error?.details?.some((d) => d.errorCode === 'UNREGISTERED');
            this.log.warn('FCM send rejected', {
                status: res.status,
                fcmStatus: body.error?.status,
            });
            return unregistered ? 'stale' : 'failed';
        }
        catch (err) {
            this.log.warn('FCM send error', { err: err.message });
            return 'failed';
        }
    }
    async getAccessToken() {
        if (this.accessToken && this.accessToken.expiresAt > Date.now()) {
            return this.accessToken.value;
        }
        try {
            const now = Math.floor(Date.now() / 1000);
            const claim = {
                iss: this.creds.client_email,
                scope: FCM_SCOPE,
                aud: this.creds.token_uri,
                iat: now,
                exp: now + 3600,
            };
            const signingInput = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url(claim)}`;
            const signature = (0, node_crypto_1.createSign)('RSA-SHA256')
                .update(signingInput)
                .sign(this.creds.private_key, 'base64url');
            const assertion = `${signingInput}.${signature}`;
            const res = await fetch(this.creds.token_uri, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    assertion,
                }),
            });
            if (!res.ok) {
                this.log.warn('FCM token mint failed', { status: res.status });
                return null;
            }
            const json = (await res.json());
            this.accessToken = {
                value: json.access_token,
                expiresAt: Date.now() + (json.expires_in - 60) * 1000,
            };
            return this.accessToken.value;
        }
        catch (err) {
            this.log.warn('FCM token mint error', { err: err.message });
            return null;
        }
    }
    loadCredentials() {
        const path = process.env.FIREBASE_CREDENTIALS_PATH;
        if (!path) {
            this.log.info('FIREBASE_CREDENTIALS_PATH not set — push channel disabled');
            return null;
        }
        try {
            const raw = (0, node_fs_1.readFileSync)((0, node_path_1.resolve)(process.cwd(), path), 'utf8');
            const json = JSON.parse(raw);
            if (!json.project_id || !json.client_email || !json.private_key) {
                this.log.warn('Firebase credentials missing required fields');
                return null;
            }
            this.log.info('FCM push channel configured', {
                projectId: json.project_id,
            });
            return {
                project_id: json.project_id,
                client_email: json.client_email,
                private_key: json.private_key,
                token_uri: json.token_uri ?? 'https://oauth2.googleapis.com/token',
            };
        }
        catch (err) {
            this.log.warn('Could not load Firebase credentials', {
                err: err.message,
            });
            return null;
        }
    }
};
exports.FcmPushProvider = FcmPushProvider;
exports.FcmPushProvider = FcmPushProvider = FcmPushProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], FcmPushProvider);
function b64url(obj) {
    return Buffer.from(JSON.stringify(obj)).toString('base64url');
}
//# sourceMappingURL=fcm-push.provider.js.map