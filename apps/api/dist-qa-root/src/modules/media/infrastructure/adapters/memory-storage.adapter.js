"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var MemoryStorageAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryStorageAdapter = void 0;
const common_1 = require("@nestjs/common");
const object_storage_port_1 = require("../../application/ports/object-storage.port");
let MemoryStorageAdapter = class MemoryStorageAdapter {
    static { MemoryStorageAdapter_1 = this; }
    provider = 'memory';
    static store = new Map();
    isConfigured() {
        return true;
    }
    put(input) {
        MemoryStorageAdapter_1.store.set(input.key, input.body);
        return Promise.resolve();
    }
    getSignedUrl(key, expirySeconds) {
        return Promise.resolve(`memory://${key}?expires=${expirySeconds}`);
    }
    get(key, opts) {
        const body = MemoryStorageAdapter_1.store.get(key);
        if (!body)
            return Promise.reject(new Error(`Object not found: ${key}`));
        if (opts?.maxBytes !== undefined && body.length > opts.maxBytes)
            return Promise.reject(new object_storage_port_1.StorageObjectTooLargeError(key, opts.maxBytes));
        return Promise.resolve(body);
    }
    delete(key) {
        MemoryStorageAdapter_1.store.delete(key);
        return Promise.resolve();
    }
};
exports.MemoryStorageAdapter = MemoryStorageAdapter;
exports.MemoryStorageAdapter = MemoryStorageAdapter = MemoryStorageAdapter_1 = __decorate([
    (0, common_1.Injectable)()
], MemoryStorageAdapter);
//# sourceMappingURL=memory-storage.adapter.js.map