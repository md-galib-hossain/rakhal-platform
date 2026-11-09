"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ANIMAL_CATEGORIES = void 0;
exports.deriveAnimalCategory = deriveAnimalCategory;
exports.buildAnimalCategoryWhere = buildAnimalCategoryWhere;
const client_1 = require("@prisma/client");
const calf_stage_1 = require("src/modules/calf/domain/calf-stage");
exports.ANIMAL_CATEGORIES = [
    'CALF',
    'HEIFER',
    'COW',
    'BULL',
    'STEER',
];
function deriveAnimalCategory({ gender, dateOfBirth, totalCalvings, now = new Date(), weaningDays = calf_stage_1.DEFAULT_WEANING_DAYS, }) {
    if (dateOfBirth && (0, calf_stage_1.ageInDays)(dateOfBirth, now) < weaningDays) {
        return 'CALF';
    }
    switch (gender) {
        case 'FEMALE':
            return totalCalvings > 0 ? 'COW' : 'HEIFER';
        case 'MALE':
            return 'BULL';
        case 'CASTRATED_MALE':
            return 'STEER';
    }
}
function buildAnimalCategoryWhere(category, now, weaningDays = calf_stage_1.DEFAULT_WEANING_DAYS) {
    const weaningCutoff = new Date(now.getTime() - weaningDays * calf_stage_1.DAY_MS);
    const notCalfByAge = {
        OR: [{ dateOfBirth: null }, { dateOfBirth: { lt: weaningCutoff } }],
    };
    switch (category) {
        case 'CALF':
            return { dateOfBirth: { gte: weaningCutoff } };
        case 'HEIFER':
            return {
                AND: [
                    { gender: client_1.CattleGender.FEMALE },
                    notCalfByAge,
                    {
                        OR: [
                            { reproductionProfile: null },
                            { reproductionProfile: { totalCalvings: 0 } },
                        ],
                    },
                ],
            };
        case 'COW':
            return {
                AND: [
                    { gender: client_1.CattleGender.FEMALE },
                    notCalfByAge,
                    { reproductionProfile: { totalCalvings: { gt: 0 } } },
                ],
            };
        case 'BULL':
            return {
                AND: [{ gender: client_1.CattleGender.MALE }, notCalfByAge],
            };
        case 'STEER':
            return {
                AND: [{ gender: client_1.CattleGender.CASTRATED_MALE }, notCalfByAge],
            };
    }
}
//# sourceMappingURL=animal-category.js.map