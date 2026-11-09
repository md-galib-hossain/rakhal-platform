"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.R2StorageAdapter = void 0;
const common_1 = require("@nestjs/common");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const env_1 = require("src/core/config/env");
const object_storage_port_1 = require("../../application/ports/object-storage.port");
let R2StorageAdapter = class R2StorageAdapter {
    provider = 'r2';
    client;
    isConfigured() {
        return Boolean(env_1.env.R2_ACCOUNT_ID &&
            env_1.env.R2_ACCESS_KEY_ID &&
            env_1.env.R2_SECRET_ACCESS_KEY &&
            env_1.env.R2_BUCKET);
    }
    async put(input) {
        await this.getClient().send(new client_s3_1.PutObjectCommand({
            Bucket: this.bucket(),
            Key: input.key,
            Body: input.body,
            ContentType: input.contentType,
        }));
    }
    getSignedUrl(key, expirySeconds) {
        return (0, s3_request_presigner_1.getSignedUrl)(this.getClient(), new client_s3_1.GetObjectCommand({ Bucket: this.bucket(), Key: key }), { expiresIn: expirySeconds });
    }
    async get(key, opts) {
        const max = opts?.maxBytes;
        const result = await this.getClient().send(new client_s3_1.GetObjectCommand({ Bucket: this.bucket(), Key: key }));
        const body = result.Body;
        if (!body)
            throw new Error(`R2 object not found: ${key}`);
        const abort = () => {
            const destroy = body.destroy;
            if (typeof destroy === 'function')
                destroy.call(body);
        };
        if (max !== undefined && (result.ContentLength ?? 0) > max) {
            abort();
            throw new object_storage_port_1.StorageObjectTooLargeError(key, max);
        }
        const chunks = [];
        let total = 0;
        for await (const chunk of body) {
            const c = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            total += c.length;
            if (max !== undefined && total > max) {
                abort();
                throw new object_storage_port_1.StorageObjectTooLargeError(key, max);
            }
            chunks.push(c);
        }
        return Buffer.concat(chunks);
    }
    async delete(key) {
        await this.getClient().send(new client_s3_1.DeleteObjectCommand({ Bucket: this.bucket(), Key: key }));
    }
    bucket() {
        const bucket = env_1.env.R2_BUCKET;
        if (!bucket)
            throw new Error('R2_BUCKET is not configured');
        return bucket;
    }
    getClient() {
        if (this.client)
            return this.client;
        const accountId = env_1.env.R2_ACCOUNT_ID;
        const accessKeyId = env_1.env.R2_ACCESS_KEY_ID;
        const secretAccessKey = env_1.env.R2_SECRET_ACCESS_KEY;
        if (!accountId || !accessKeyId || !secretAccessKey) {
            throw new Error('R2 credentials are not configured');
        }
        this.client = new client_s3_1.S3Client({
            region: 'auto',
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: { accessKeyId, secretAccessKey },
        });
        return this.client;
    }
};
exports.R2StorageAdapter = R2StorageAdapter;
exports.R2StorageAdapter = R2StorageAdapter = __decorate([
    (0, common_1.Injectable)()
], R2StorageAdapter);
//# sourceMappingURL=r2-storage.adapter.js.map