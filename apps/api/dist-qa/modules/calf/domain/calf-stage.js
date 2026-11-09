"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_WEANING_DAYS = exports.DAY_MS = void 0;
exports.ageInDays = ageInDays;
exports.stageForAge = stageForAge;
exports.stageDobRange = stageDobRange;
exports.computeAdg = computeAdg;
exports.weaningTargetDate = weaningTargetDate;
exports.DAY_MS = 24 * 60 * 60 * 1000;
exports.DEFAULT_WEANING_DAYS = 60;
function ageInDays(dateOfBirth, now = new Date()) {
    return Math.max(0, Math.floor((now.getTime() - dateOfBirth.getTime()) / exports.DAY_MS));
}
function stageForAge(ageDays) {
    if (ageDays < 7)
        return 'newborn';
    if (ageDays < 60)
        return 'young';
    if (ageDays < 90)
        return 'pre_weaning';
    return 'post_weaning';
}
function stageDobRange(stage, now = new Date()) {
    const at = (days) => new Date(now.getTime() - days * exports.DAY_MS);
    switch (stage) {
        case 'newborn':
            return { gte: at(7) };
        case 'young':
            return { gte: at(60), lt: at(7) };
        case 'pre_weaning':
            return { gte: at(90), lt: at(60) };
        case 'post_weaning':
            return { lt: at(90) };
    }
}
function computeAdg(birthWeightKg, currentWeightKg, ageDays) {
    if (birthWeightKg == null || currentWeightKg == null || ageDays <= 0) {
        return null;
    }
    return Math.round(((currentWeightKg - birthWeightKg) / ageDays) * 100) / 100;
}
function weaningTargetDate(dateOfBirth, days = exports.DEFAULT_WEANING_DAYS) {
    return new Date(dateOfBirth.getTime() + days * exports.DAY_MS);
}
//# sourceMappingURL=calf-stage.js.map