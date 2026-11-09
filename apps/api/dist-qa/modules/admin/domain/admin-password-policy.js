"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_PASSWORD_MAX_LENGTH = exports.ADMIN_PASSWORD_MIN_LENGTH = void 0;
exports.adminPasswordProblems = adminPasswordProblems;
exports.assertAdminPasswordPolicy = assertAdminPasswordPolicy;
exports.generateTemporaryAdminPassword = generateTemporaryAdminPassword;
const crypto_1 = require("crypto");
const common_1 = require("@nestjs/common");
exports.ADMIN_PASSWORD_MIN_LENGTH = 12;
exports.ADMIN_PASSWORD_MAX_LENGTH = 128;
function adminPasswordProblems(password) {
    const problems = [];
    if (password.length < exports.ADMIN_PASSWORD_MIN_LENGTH) {
        problems.push(`at least ${exports.ADMIN_PASSWORD_MIN_LENGTH} characters`);
    }
    if (password.length > exports.ADMIN_PASSWORD_MAX_LENGTH) {
        problems.push(`at most ${exports.ADMIN_PASSWORD_MAX_LENGTH} characters`);
    }
    if (!/[a-z]/.test(password))
        problems.push('a lowercase letter');
    if (!/[A-Z]/.test(password))
        problems.push('an uppercase letter');
    if (!/\d/.test(password))
        problems.push('a digit');
    if (/\s/.test(password))
        problems.push('no whitespace');
    return problems;
}
function assertAdminPasswordPolicy(password) {
    const problems = adminPasswordProblems(password);
    if (problems.length > 0) {
        throw new common_1.BadRequestException(`Password must contain ${problems.join(', ')}`);
    }
}
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
function generateTemporaryAdminPassword(length = 16) {
    const all = LOWER + UPPER + DIGITS;
    const pick = (set) => set[(0, crypto_1.randomInt)(set.length)];
    const chars = [pick(LOWER), pick(UPPER), pick(DIGITS)];
    while (chars.length < length)
        chars.push(pick(all));
    for (let i = chars.length - 1; i > 0; i--) {
        const j = (0, crypto_1.randomInt)(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
}
//# sourceMappingURL=admin-password-policy.js.map