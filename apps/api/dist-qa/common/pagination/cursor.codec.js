"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeCursor = encodeCursor;
exports.decodeCursor = decodeCursor;
const common_1 = require("@nestjs/common");
function encodeCursor(payload) {
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}
function decodeCursor(cursor) {
    try {
        const json = Buffer.from(cursor, 'base64url').toString('utf8');
        const parsed = JSON.parse(json);
        if (!parsed ||
            typeof parsed !== 'object' ||
            typeof parsed.id !== 'string') {
            throw new Error('Cursor payload missing id');
        }
        return parsed;
    }
    catch {
        throw new common_1.BadRequestException('Invalid pagination cursor');
    }
}
//# sourceMappingURL=cursor.codec.js.map