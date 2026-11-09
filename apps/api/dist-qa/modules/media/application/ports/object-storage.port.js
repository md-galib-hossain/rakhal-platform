"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageObjectTooLargeError = exports.OBJECT_STORAGE = void 0;
exports.OBJECT_STORAGE = Symbol('OBJECT_STORAGE');
class StorageObjectTooLargeError extends Error {
    key;
    maxBytes;
    constructor(key, maxBytes) {
        super(`Object ${key} exceeds ${maxBytes} bytes`);
        this.key = key;
        this.maxBytes = maxBytes;
        this.name = 'StorageObjectTooLargeError';
    }
}
exports.StorageObjectTooLargeError = StorageObjectTooLargeError;
//# sourceMappingURL=object-storage.port.js.map