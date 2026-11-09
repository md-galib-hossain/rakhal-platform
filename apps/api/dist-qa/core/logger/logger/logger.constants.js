"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOG_LEVELS = exports.SENSITIVE_PATHS = exports.LOGGER_CONTEXT_TOKEN = void 0;
exports.LOGGER_CONTEXT_TOKEN = 'LOGGER_CONTEXT';
exports.SENSITIVE_PATHS = [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers["set-cookie"]',
    'req.headers["x-api-key"]',
    'req.body.password',
    'req.body.confirmPassword',
    'req.body.token',
    'req.body.accessToken',
    'req.body.refreshToken',
    'req.body.authorization',
    'req.body.otp',
    'req.body.nid',
    'req.body.nidNumber',
    'req.body.identityNumber',
    'req.body.secret',
    'req.body.creditCard',
    'req.body.ssn',
];
exports.LOG_LEVELS = [
    'trace',
    'debug',
    'info',
    'warn',
    'error',
    'fatal',
];
//# sourceMappingURL=logger.constants.js.map