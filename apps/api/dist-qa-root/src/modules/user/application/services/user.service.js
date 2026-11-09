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
var UserService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const common_1 = require("@nestjs/common");
const logger_context_1 = require("src/core/logger/logger/logger.context");
const logger_service_1 = require("src/core/logger/logger/logger.service");
let UserService = UserService_1 = class UserService {
    logger;
    ctx;
    users = [];
    idCounter = 1;
    log;
    constructor(logger, ctx) {
        this.logger = logger;
        this.ctx = ctx;
        this.log = this.logger.setContext(UserService_1.name);
    }
    findAll() {
        throw Error('Users not found');
        return this.users;
    }
    create(createUserDto) {
        const newUser = {
            id: this.idCounter++,
            ...createUserDto,
        };
        this.users.push(newUser);
        this.log.info('User created', { id: newUser.id });
        return newUser;
    }
    findUserById(id) {
        this.ctx.set('userId', String(id));
        this.log.info('Finding user by ID', { id });
        return this.users.find((user) => user.id === id);
    }
};
exports.UserService = UserService;
exports.UserService = UserService = UserService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [logger_service_1.LoggerService,
        logger_context_1.LoggerContext])
], UserService);
//# sourceMappingURL=user.service.js.map