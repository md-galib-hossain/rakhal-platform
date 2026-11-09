"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVENT_CATALOGUE = exports.EVENT_CHIPS = exports.ANIMAL_EVENT_TYPES = void 0;
exports.ANIMAL_EVENT_TYPES = [
    'HEAT',
    'BREEDING',
    'PREG_CHECK',
    'CALVING',
    'ABORTION',
    'DRY_OFF',
    'ILLNESS',
    'TREATMENT',
    'VACCINATION',
    'DEWORMING',
    'WEIGHT',
    'BCS',
    'WEANING',
    'CASTRATION',
    'ENTER_FATTENING',
    'LEAVE_FATTENING',
    'MOVE',
    'SOLD',
    'DIED',
    'CULLED',
    'NOTE',
    'HOOF_TRIM',
    'DEHORN',
    'CUSTOM',
];
exports.EVENT_CHIPS = [
    'FEMALE',
    'MALE',
    'CALF',
    'HEIFER',
    'COW',
    'PREGNANT',
    'OPEN',
    'MILKING',
    'DRY',
    'FATTENING',
];
const CODE = {
    L: 'LISTED',
    W: 'WARN',
    '-': 'BLOCK',
};
function chips(row) {
    if (row.length !== exports.EVENT_CHIPS.length) {
        throw new Error(`eligibility row must have ${exports.EVENT_CHIPS.length} cells`);
    }
    const out = {};
    exports.EVENT_CHIPS.forEach((chip, i) => {
        out[chip] = CODE[row[i]];
    });
    return out;
}
const ALL = 'LLLLLLLLLL';
const FEMALE_REPRO = ['FEMALE_ONLY', 'NOT_BEFORE_BIRTH', 'NOT_FUTURE'];
const COMMON = ['NOT_BEFORE_BIRTH', 'NOT_FUTURE', 'NOT_AFTER_EXIT'];
function def(type, group, detailTable, row, permission, opts = {}) {
    return {
        type,
        group,
        labelKey: `animalEvents.types.${type}`,
        detailTable,
        appliesTo: chips(row),
        hardRules: opts.hardRules ?? COMMON,
        permission,
        allowsHistorical: opts.allowsHistorical ?? true,
        followUps: opts.followUps ?? [],
        ...(opts.requiresChip ? { requiresChip: opts.requiresChip } : {}),
    };
}
exports.EVENT_CATALOGUE = [
    def('HEAT', 'REPRODUCTION', 'HeatEvent', 'L--LLWLLLW', 'reproduction.heat', {
        hardRules: FEMALE_REPRO,
        followUps: ['HEAT_WATCH_AFTER_HEAT'],
    }),
    def('BREEDING', 'REPRODUCTION', 'BreedingEvent', 'L--LLWLLLW', 'reproduction.create', { hardRules: FEMALE_REPRO, followUps: ['PREG_CHECK_AFTER_BREEDING'] }),
    def('PREG_CHECK', 'REPRODUCTION', 'PregnancyDiagnosis', 'L--LLLLLLW', 'reproduction.create', { hardRules: FEMALE_REPRO }),
    def('CALVING', 'REPRODUCTION', 'CalvingEvent', 'L--LLLWWLW', 'reproduction.create', { hardRules: FEMALE_REPRO }),
    def('ABORTION', 'REPRODUCTION', 'AbortionEvent', 'L--LLLWWWW', 'reproduction.create', { hardRules: FEMALE_REPRO }),
    def('DRY_OFF', 'REPRODUCTION', 'DryPeriod', 'L---LLLL-W', 'reproduction.create', { hardRules: FEMALE_REPRO }),
    def('ILLNESS', 'HEALTH', 'HealthCase', ALL, 'healthcare.report-sickness'),
    def('TREATMENT', 'HEALTH', 'TreatmentLog', ALL, 'healthcare.log-treatment'),
    def('VACCINATION', 'HEALTH', 'TreatmentLog', ALL, 'healthcare.log-treatment'),
    def('DEWORMING', 'HEALTH', 'TreatmentLog', ALL, 'healthcare.log-treatment'),
    def('WEIGHT', 'GROWTH', 'WeightRecord', ALL, 'cattle.update'),
    def('BCS', 'GROWTH', 'BodyConditionScore', 'LLWLLLLLLL', 'cattle.bcs'),
    def('WEANING', 'GROWTH', 'CalfWeaningRecord', 'LLL-------', 'calf.update'),
    def('CASTRATION', 'GROWTH', null, '-LL------L', 'cattle.update', {
        hardRules: ['MALE_ONLY', ...COMMON],
    }),
    def('ENTER_FATTENING', 'GROWTH', null, 'LLWLLWLWL-', 'cattle.update'),
    def('LEAVE_FATTENING', 'GROWTH', null, '---------L', 'cattle.update', {
        requiresChip: 'FATTENING',
    }),
    def('MOVE', 'MOVEMENT', null, ALL, 'cattle.update'),
    def('SOLD', 'MOVEMENT', 'CattleDisposition', ALL, 'cattle.dispose', {
        allowsHistorical: false,
    }),
    def('DIED', 'MOVEMENT', 'MortalityRecord', ALL, 'cattle.dispose', {
        allowsHistorical: false,
    }),
    def('CULLED', 'MOVEMENT', 'CattleDisposition', ALL, 'cattle.dispose', {
        allowsHistorical: false,
    }),
    def('NOTE', 'OTHER', null, ALL, 'cattle.update'),
    def('HOOF_TRIM', 'HEALTH', null, ALL, 'cattle.update'),
    def('DEHORN', 'HEALTH', null, ALL, 'cattle.update'),
    def('CUSTOM', 'OTHER', null, ALL, 'cattle.update'),
];
//# sourceMappingURL=catalogue.js.map