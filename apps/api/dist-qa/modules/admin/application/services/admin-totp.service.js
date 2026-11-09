"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminTotpService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;
function base32Encode(buffer) {
    let bits = 0;
    let value = 0;
    let output = '';
    for (const byte of buffer) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) {
        output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }
    return output;
}
function base32Decode(secret) {
    const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
    let bits = 0;
    let value = 0;
    const bytes = [];
    for (const char of clean) {
        const idx = BASE32_ALPHABET.indexOf(char);
        if (idx === -1)
            continue;
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return Buffer.from(bytes);
}
let AdminTotpService = class AdminTotpService {
    generateSecret() {
        return base32Encode((0, node_crypto_1.randomBytes)(20));
    }
    buildOtpAuthUrl(email, secretBase32) {
        const label = encodeURIComponent(`Rakhal Admin:${email}`);
        const issuer = encodeURIComponent('Rakhal');
        return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${issuer}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
    }
    currentCode(secretBase32) {
        return this.hotp(secretBase32, Math.floor(Date.now() / 1000 / STEP_SECONDS));
    }
    hotp(secretBase32, counter) {
        const key = base32Decode(secretBase32);
        const counterBuffer = Buffer.alloc(8);
        counterBuffer.writeBigUInt64BE(BigInt(counter));
        const hmac = (0, node_crypto_1.createHmac)('sha1', key).update(counterBuffer).digest();
        const offset = hmac[hmac.length - 1] & 0x0f;
        const binary = ((hmac[offset] & 0x7f) << 24) |
            ((hmac[offset + 1] & 0xff) << 16) |
            ((hmac[offset + 2] & 0xff) << 8) |
            (hmac[offset + 3] & 0xff);
        const code = (binary % 10 ** DIGITS).toString().padStart(DIGITS, '0');
        return code;
    }
    verify(secretBase32, token, window = 1) {
        if (!/^\d{6}$/.test(token))
            return false;
        const counter = Math.floor(Date.now() / 1000 / STEP_SECONDS);
        const tokenBuffer = Buffer.from(token);
        for (let offset = -window; offset <= window; offset++) {
            const expected = Buffer.from(this.hotp(secretBase32, counter + offset));
            if (expected.length === tokenBuffer.length &&
                (0, node_crypto_1.timingSafeEqual)(expected, tokenBuffer)) {
                return true;
            }
        }
        return false;
    }
};
exports.AdminTotpService = AdminTotpService;
exports.AdminTotpService = AdminTotpService = __decorate([
    (0, common_1.Injectable)()
], AdminTotpService);
//# sourceMappingURL=admin-totp.service.js.map