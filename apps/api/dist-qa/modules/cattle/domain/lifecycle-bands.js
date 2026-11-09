"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIFECYCLE_BANDS = exports.LIFECYCLE_SUB_STAGES = exports.DEFAULT_LIFECYCLE_BOUNDARIES = exports.LIFECYCLE_BREEDING_AGE_DAYS = exports.LIFECYCLE_GROWING_START_DAYS = exports.LIFECYCLE_WEANING_DAYS = void 0;
exports.deriveLifecycleSubStage = deriveLifecycleSubStage;
exports.buildLifecycleSubStageWhere = buildLifecycleSubStageWhere;
const client_1 = require("@prisma/client");
const calf_stage_1 = require("src/modules/calf/domain/calf-stage");
const animal_category_1 = require("./animal-category");
exports.LIFECYCLE_WEANING_DAYS = 60;
exports.LIFECYCLE_GROWING_START_DAYS = 180;
exports.LIFECYCLE_BREEDING_AGE_DAYS = 390;
exports.DEFAULT_LIFECYCLE_BOUNDARIES = {
    weaningDays: exports.LIFECYCLE_WEANING_DAYS,
    growingStartDays: exports.LIFECYCLE_GROWING_START_DAYS,
    breedingAgeDays: exports.LIFECYCLE_BREEDING_AGE_DAYS,
};
exports.LIFECYCLE_SUB_STAGES = [
    'WEANED_HEIFER',
    'GROWING_HEIFER',
    'BREEDING_HEIFER',
    'WEANER_BULL',
    'GROWING_BULL',
    'MATURE_BULL',
];
function buildLifecycleBands(b) {
    return [
        {
            subStage: 'WEANED_HEIFER',
            category: 'HEIFER',
            minDays: b.weaningDays,
            maxDays: b.growingStartDays,
        },
        {
            subStage: 'GROWING_HEIFER',
            category: 'HEIFER',
            minDays: b.growingStartDays,
            maxDays: b.breedingAgeDays,
        },
        {
            subStage: 'BREEDING_HEIFER',
            category: 'HEIFER',
            minDays: b.breedingAgeDays,
            maxDays: null,
        },
        {
            subStage: 'WEANER_BULL',
            category: 'BULL',
            minDays: b.weaningDays,
            maxDays: b.growingStartDays,
        },
        {
            subStage: 'GROWING_BULL',
            category: 'BULL',
            minDays: b.growingStartDays,
            maxDays: b.breedingAgeDays,
        },
        {
            subStage: 'MATURE_BULL',
            category: 'BULL',
            minDays: b.breedingAgeDays,
            maxDays: null,
        },
    ];
}
exports.LIFECYCLE_BANDS = buildLifecycleBands(exports.DEFAULT_LIFECYCLE_BOUNDARIES);
function deriveLifecycleSubStage({ gender, dateOfBirth, totalCalvings, now = new Date(), boundaries = exports.DEFAULT_LIFECYCLE_BOUNDARIES, }) {
    if (!dateOfBirth)
        return null;
    const category = (0, animal_category_1.deriveAnimalCategory)({
        gender,
        dateOfBirth,
        totalCalvings,
        now,
    });
    const ageDays = (0, calf_stage_1.ageInDays)(dateOfBirth, now);
    const bands = boundaries === exports.DEFAULT_LIFECYCLE_BOUNDARIES
        ? exports.LIFECYCLE_BANDS
        : buildLifecycleBands(boundaries);
    const band = bands.find((b) => b.category === category &&
        ageDays >= b.minDays &&
        (b.maxDays === null || ageDays < b.maxDays));
    return band?.subStage ?? null;
}
function buildLifecycleSubStageWhere(subStage, now, boundaries = exports.DEFAULT_LIFECYCLE_BOUNDARIES) {
    const bands = boundaries === exports.DEFAULT_LIFECYCLE_BOUNDARIES
        ? exports.LIFECYCLE_BANDS
        : buildLifecycleBands(boundaries);
    const band = bands.find((b) => b.subStage === subStage);
    if (!band) {
        throw new Error(`Unknown lifecycle sub-stage: ${subStage}`);
    }
    const minDate = new Date(now.getTime() - band.minDays * calf_stage_1.DAY_MS);
    const dateOfBirth = { lte: minDate };
    if (band.maxDays !== null) {
        dateOfBirth.gt = new Date(now.getTime() - band.maxDays * calf_stage_1.DAY_MS);
    }
    const genderFilter = band.category === 'HEIFER'
        ? client_1.CattleGender.FEMALE
        : client_1.CattleGender.MALE;
    const calvingFilter = band.category === 'HEIFER'
        ? {
            OR: [
                { reproductionProfile: null },
                { reproductionProfile: { totalCalvings: 0 } },
            ],
        }
        : {};
    return {
        AND: [{ gender: genderFilter }, { dateOfBirth }, calvingFilter],
    };
}
//# sourceMappingURL=lifecycle-bands.js.map