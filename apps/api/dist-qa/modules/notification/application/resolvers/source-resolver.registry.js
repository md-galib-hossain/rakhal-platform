"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceResolverRegistry = void 0;
const common_1 = require("@nestjs/common");
let SourceResolverRegistry = class SourceResolverRegistry {
    resolvers = new Map();
    anchors = new Map();
    register(resolver) {
        this.resolvers.set(resolver.sourceType, resolver);
    }
    registerAnchorChecker(checker) {
        this.anchors.set(checker.anchorType, checker);
    }
    get(sourceType) {
        return this.resolvers.get(sourceType);
    }
    getAnchorChecker(anchorType) {
        return this.anchors.get(anchorType);
    }
};
exports.SourceResolverRegistry = SourceResolverRegistry;
exports.SourceResolverRegistry = SourceResolverRegistry = __decorate([
    (0, common_1.Injectable)()
], SourceResolverRegistry);
//# sourceMappingURL=source-resolver.registry.js.map