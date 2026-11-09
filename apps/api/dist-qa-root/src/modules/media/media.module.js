"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const env_1 = require("src/core/config/env");
const auth_module_1 = require("../auth/auth.module");
const tenant_access_module_1 = require("../tenant-access/tenant-access.module");
const permission_module_1 = require("../permission/permission.module");
const media_service_1 = require("./application/services/media.service");
const image_processor_service_1 = require("./application/services/image-processor.service");
const object_storage_port_1 = require("./application/ports/object-storage.port");
const r2_storage_adapter_1 = require("./infrastructure/adapters/r2-storage.adapter");
const memory_storage_adapter_1 = require("./infrastructure/adapters/memory-storage.adapter");
const media_controller_1 = require("./presentation/controllers/media.controller");
let MediaModule = class MediaModule {
};
exports.MediaModule = MediaModule;
exports.MediaModule = MediaModule = __decorate([
    (0, common_1.Module)({
        imports: [logger_module_1.LoggerModule, auth_module_1.AuthModule, tenant_access_module_1.TenantAccessModule, permission_module_1.PermissionModule],
        controllers: [media_controller_1.MediaController],
        providers: [
            media_service_1.MediaService,
            image_processor_service_1.ImageProcessorService,
            r2_storage_adapter_1.R2StorageAdapter,
            memory_storage_adapter_1.MemoryStorageAdapter,
            {
                provide: object_storage_port_1.OBJECT_STORAGE,
                useFactory: (r2, memory) => {
                    if (env_1.env.NODE_ENV === 'test')
                        return memory;
                    if (env_1.env.STORAGE_PROVIDER === 'r2') {
                        if (!r2.isConfigured()) {
                            throw new Error('STORAGE_PROVIDER=r2 but R2_* credentials are missing');
                        }
                        return r2;
                    }
                    return memory;
                },
                inject: [r2_storage_adapter_1.R2StorageAdapter, memory_storage_adapter_1.MemoryStorageAdapter],
            },
        ],
        exports: [media_service_1.MediaService, object_storage_port_1.OBJECT_STORAGE],
    })
], MediaModule);
//# sourceMappingURL=media.module.js.map