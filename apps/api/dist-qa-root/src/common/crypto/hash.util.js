"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOpaqueToken = generateOpaqueToken;
exports.sha256Hex = sha256Hex;
exports.safeEqualHex = safeEqualHex;
const crypto_1 = require("crypto");
function generateOpaqueToken(byteLength = 32) {
    return (0, crypto_1.randomBytes)(byteLength).toString('base64url');
}
function sha256Hex(value) {
    return (0, crypto_1.createHash)('sha256').update(value, 'utf8').digest('hex');
}
function safeEqualHex(a, b) {
    try {
        const bufferA = Buffer.from(a, 'hex');
        const bufferB = Buffer.from(b, 'hex');
        if (bufferA.length === 0 || bufferA.length !== bufferB.length) {
            return false;
        }
        return (0, crypto_1.timingSafeEqual)(bufferA, bufferB);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=hash.util.js.map