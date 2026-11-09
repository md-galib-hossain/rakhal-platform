"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REQUIREMENT_SETTING_KEYS = exports.REQUIREMENT_SETTING_FIELDS = exports.DEFAULT_REQUIREMENT_SETTINGS = void 0;
exports.validateSettings = validateSettings;
exports.mergeSettings = mergeSettings;
exports.parseSettings = parseSettings;
exports.DEFAULT_REQUIREMENT_SETTINGS = {
    maintenanceEnergyPerMetabolicKg: 0.49,
    energyPerLitreMilk: 5.0,
    energyPerMilkFatPercent: 0.25,
    netEnergyEfficiency: 0.62,
    maintenanceProteinPerMetabolicKg: 3.8,
    proteinPerLitreMilk: 85,
    degradableProteinShare: 62,
    undegradableProteinShare: 38,
    intakeFromMilkFactor: 0.372,
    intakeFromBodyWeightFactor: 0.0968,
    intakeCurveSteepness: 0.192,
    intakeCurveOffset: 3.67,
    defaultDaysInMilk: 100,
    defaultWeightKg: 450,
    alertDryMatterBelowPct: 10,
    alertDryMatterAbovePct: 10,
    alertProteinBelowPct: 10,
    alertProteinAbovePct: 20,
    alertEnergyBelowPct: 10,
    alertEnergyAbovePct: 10,
    manualOverrideDriftPct: 15,
    lookaheadDays: 14,
    pregnancyIntakeStages: [
        { untilDay: 90, percentOfBodyWeight: 0.02 },
        { untilDay: 180, percentOfBodyWeight: 0.021 },
        { untilDay: 240, percentOfBodyWeight: 0.022 },
        { untilDay: 285, percentOfBodyWeight: 0.023 },
    ],
    pregnancyLengthDays: 280,
    pregnancyPeakEnergy: 8.4,
    pregnancyPeakProtein: 0.5,
    heiferIntakePercentOfBodyWeight: 0.025,
    heiferGrowthEnergy: 6.0,
    heiferGrowthProtein: 0.15,
    targetBodyCondition: 3.0,
    energyAdjustPerBodyConditionStep: 0.03,
    intakeAdjustPerBodyConditionPoint: 0.375,
    tdnShareOfIntake: 0.68,
    adfShareOfIntake: 0.19,
    ndfMinShareOfIntake: 0.3,
    ndfMaxShareOfIntake: 0.4,
    fatShareOfIntake: 0.04,
    calciumPerBodyWeightKg: 0.031,
    calciumPerLitreMilk: 1.22,
    phosphorusPerBodyWeightKg: 0.024,
    phosphorusPerLitreMilk: 0.9,
    calciumToPhosphorusTarget: 2.0,
};
exports.REQUIREMENT_SETTING_FIELDS = {
    maintenanceEnergyPerMetabolicKg: {
        group: 'energy',
        label: 'Maintenance energy per metabolic kg',
        unit: 'MJ / kg^0.75',
        min: 0.1,
        max: 2,
    },
    energyPerLitreMilk: {
        group: 'energy',
        label: 'Energy per litre of milk',
        unit: 'MJ / L',
        min: 1,
        max: 15,
    },
    energyPerMilkFatPercent: {
        group: 'energy',
        label: 'Energy per 1% milk fat',
        unit: 'MJ / L per %',
        min: 0,
        max: 2,
    },
    netEnergyEfficiency: {
        group: 'energy',
        label: 'Net energy conversion efficiency',
        unit: '',
        min: 0.1,
        max: 1,
    },
    maintenanceProteinPerMetabolicKg: {
        group: 'protein',
        label: 'Maintenance protein per metabolic kg',
        unit: 'g / kg^0.75',
        min: 0.5,
        max: 15,
    },
    proteinPerLitreMilk: {
        group: 'protein',
        label: 'Protein per litre of milk',
        unit: 'g / L',
        min: 20,
        max: 200,
    },
    degradableProteinShare: {
        group: 'protein',
        label: 'Degradable protein share',
        unit: '% of crude protein',
        min: 0,
        max: 100,
    },
    undegradableProteinShare: {
        group: 'protein',
        label: 'Undegradable protein share',
        unit: '% of crude protein',
        min: 0,
        max: 100,
    },
    intakeFromMilkFactor: {
        group: 'intake',
        label: 'Intake from milk',
        unit: 'kg DM per kg FCM',
        min: 0.05,
        max: 1.5,
    },
    intakeFromBodyWeightFactor: {
        group: 'intake',
        label: 'Intake from body weight',
        unit: 'kg DM / kg^0.75',
        min: 0.01,
        max: 0.5,
    },
    intakeCurveSteepness: {
        group: 'intake',
        label: 'Intake curve steepness',
        unit: '',
        min: 0.01,
        max: 1,
    },
    intakeCurveOffset: {
        group: 'intake',
        label: 'Intake curve offset',
        unit: 'weeks',
        min: 0,
        max: 20,
    },
    defaultDaysInMilk: {
        group: 'intake',
        label: 'Assumed days in milk when unknown',
        unit: 'days',
        min: 1,
        max: 500,
    },
    defaultWeightKg: {
        group: 'intake',
        label: 'Assumed body weight when unweighed',
        unit: 'kg',
        min: 100,
        max: 1000,
    },
    alertDryMatterBelowPct: {
        group: 'alerts',
        label: 'Dry matter: allowed shortfall',
        unit: '%',
        min: 0,
        max: 100,
    },
    alertDryMatterAbovePct: {
        group: 'alerts',
        label: 'Dry matter: allowed excess',
        unit: '%',
        min: 0,
        max: 100,
    },
    alertProteinBelowPct: {
        group: 'alerts',
        label: 'Protein: allowed shortfall',
        unit: '%',
        min: 0,
        max: 100,
    },
    alertProteinAbovePct: {
        group: 'alerts',
        label: 'Protein: allowed excess',
        unit: '%',
        min: 0,
        max: 100,
    },
    alertEnergyBelowPct: {
        group: 'alerts',
        label: 'Energy: allowed shortfall',
        unit: '%',
        min: 0,
        max: 100,
    },
    alertEnergyAbovePct: {
        group: 'alerts',
        label: 'Energy: allowed excess',
        unit: '%',
        min: 0,
        max: 100,
    },
    manualOverrideDriftPct: {
        group: 'alerts',
        label: 'Manual requirement: warn when the calculated need changes by',
        unit: '%',
        min: 0,
        max: 100,
    },
    lookaheadDays: {
        group: 'alerts',
        label: 'Look-ahead: warn this many days before dry-off, calving or peak',
        unit: 'days',
        min: 1,
        max: 60,
    },
    pregnancyLengthDays: {
        group: 'pregnancy',
        label: 'Full-term gestation length',
        unit: 'days',
        min: 200,
        max: 320,
    },
    pregnancyPeakEnergy: {
        group: 'pregnancy',
        label: 'Extra energy at full term',
        unit: 'MJ / day',
        min: 0,
        max: 40,
    },
    pregnancyPeakProtein: {
        group: 'pregnancy',
        label: 'Extra protein at full term',
        unit: 'kg / day',
        min: 0,
        max: 3,
    },
    heiferIntakePercentOfBodyWeight: {
        group: 'heifer',
        label: 'Heifer intake',
        unit: 'fraction of body weight',
        min: 0.005,
        max: 0.06,
    },
    heiferGrowthEnergy: {
        group: 'heifer',
        label: 'Extra energy for growth',
        unit: 'MJ / day',
        min: 0,
        max: 40,
    },
    heiferGrowthProtein: {
        group: 'heifer',
        label: 'Extra protein for growth',
        unit: 'kg / day',
        min: 0,
        max: 3,
    },
    targetBodyCondition: {
        group: 'bodyCondition',
        label: 'Target body condition score',
        unit: '1-5 scale',
        min: 1,
        max: 5,
    },
    energyAdjustPerBodyConditionStep: {
        group: 'bodyCondition',
        label: 'Energy change per 0.25 condition step',
        unit: 'fraction of maintenance',
        min: 0,
        max: 0.5,
    },
    intakeAdjustPerBodyConditionPoint: {
        group: 'bodyCondition',
        label: 'Intake change per condition point',
        unit: 'kg DM',
        min: 0,
        max: 3,
    },
    tdnShareOfIntake: {
        group: 'mineralsAndFibre',
        label: 'Total digestible nutrients',
        unit: 'fraction of intake',
        min: 0.1,
        max: 1,
    },
    adfShareOfIntake: {
        group: 'mineralsAndFibre',
        label: 'Minimum acid detergent fibre',
        unit: 'fraction of intake',
        min: 0,
        max: 1,
    },
    ndfMinShareOfIntake: {
        group: 'mineralsAndFibre',
        label: 'Minimum neutral detergent fibre',
        unit: 'fraction of intake',
        min: 0,
        max: 1,
    },
    ndfMaxShareOfIntake: {
        group: 'mineralsAndFibre',
        label: 'Maximum neutral detergent fibre',
        unit: 'fraction of intake',
        min: 0,
        max: 1,
    },
    fatShareOfIntake: {
        group: 'mineralsAndFibre',
        label: 'Dietary fat',
        unit: 'fraction of intake',
        min: 0,
        max: 0.3,
    },
    calciumPerBodyWeightKg: {
        group: 'mineralsAndFibre',
        label: 'Maintenance calcium per kg body weight',
        unit: 'g / kg',
        min: 0,
        max: 1,
    },
    calciumPerLitreMilk: {
        group: 'mineralsAndFibre',
        label: 'Calcium per litre of milk',
        unit: 'g / L',
        min: 0,
        max: 10,
    },
    phosphorusPerBodyWeightKg: {
        group: 'mineralsAndFibre',
        label: 'Maintenance phosphorus per kg body weight',
        unit: 'g / kg',
        min: 0,
        max: 1,
    },
    phosphorusPerLitreMilk: {
        group: 'mineralsAndFibre',
        label: 'Phosphorus per litre of milk',
        unit: 'g / L',
        min: 0,
        max: 10,
    },
    calciumToPhosphorusTarget: {
        group: 'mineralsAndFibre',
        label: 'Target calcium-to-phosphorus ratio',
        unit: ': 1',
        min: 0.5,
        max: 6,
    },
};
exports.REQUIREMENT_SETTING_KEYS = [
    ...Object.keys(exports.REQUIREMENT_SETTING_FIELDS),
    'pregnancyIntakeStages',
];
const MAX_PREGNANCY_STAGES = 12;
function isFiniteNumber(v) {
    return typeof v === 'number' && Number.isFinite(v);
}
function validateStages(value) {
    const field = 'pregnancyIntakeStages';
    if (!Array.isArray(value)) {
        return [{ field, message: 'must be a list of stages' }];
    }
    if (value.length === 0) {
        return [{ field, message: 'must have at least one stage' }];
    }
    if (value.length > MAX_PREGNANCY_STAGES) {
        return [
            { field, message: `must have at most ${MAX_PREGNANCY_STAGES} stages` },
        ];
    }
    const issues = [];
    let previousDay = 0;
    value.forEach((raw, index) => {
        const at = `${field}[${index}]`;
        if (typeof raw !== 'object' || raw === null) {
            issues.push({ field: at, message: 'must be an object' });
            return;
        }
        const stage = raw;
        if (!isFiniteNumber(stage.untilDay) || stage.untilDay <= 0) {
            issues.push({ field: `${at}.untilDay`, message: 'must be above 0' });
        }
        else if (stage.untilDay > 320) {
            issues.push({ field: `${at}.untilDay`, message: 'must be at most 320' });
        }
        else if (stage.untilDay <= previousDay) {
            issues.push({
                field: `${at}.untilDay`,
                message: 'stages must be ordered by ascending day',
            });
        }
        else {
            previousDay = stage.untilDay;
        }
        if (!isFiniteNumber(stage.percentOfBodyWeight) ||
            stage.percentOfBodyWeight <= 0 ||
            stage.percentOfBodyWeight > 0.1) {
            issues.push({
                field: `${at}.percentOfBodyWeight`,
                message: 'must be a fraction of body weight between 0 and 0.1',
            });
        }
    });
    return issues;
}
function validateSettings(changes) {
    if (typeof changes !== 'object' ||
        changes === null ||
        Array.isArray(changes)) {
        return [{ field: '', message: 'must be an object' }];
    }
    const issues = [];
    const known = new Set(exports.REQUIREMENT_SETTING_KEYS);
    for (const [field, value] of Object.entries(changes)) {
        if (!known.has(field)) {
            issues.push({ field, message: 'is not a requirement setting' });
            continue;
        }
        if (value === undefined)
            continue;
        if (field === 'pregnancyIntakeStages') {
            issues.push(...validateStages(value));
            continue;
        }
        const spec = exports.REQUIREMENT_SETTING_FIELDS[field];
        if (!isFiniteNumber(value)) {
            issues.push({ field, message: 'must be a number' });
        }
        else if (value < spec.min || value > spec.max) {
            issues.push({
                field,
                message: `must be between ${spec.min} and ${spec.max} ${spec.unit}`.trim(),
            });
        }
    }
    return issues;
}
function mergeSettings(base, changes) {
    if (!changes)
        return base;
    const merged = {
        ...base,
        pregnancyIntakeStages: base.pregnancyIntakeStages.map((s) => ({ ...s })),
    };
    for (const key of exports.REQUIREMENT_SETTING_KEYS) {
        const value = changes[key];
        if (value === undefined || value === null)
            continue;
        if (key === 'pregnancyIntakeStages') {
            merged.pregnancyIntakeStages = value.map((s) => ({
                untilDay: s.untilDay,
                percentOfBodyWeight: s.percentOfBodyWeight,
            }));
        }
        else if (isFiniteNumber(value)) {
            merged[key] = value;
        }
    }
    return merged;
}
function parseSettings(stored, base = exports.DEFAULT_REQUIREMENT_SETTINGS) {
    if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) {
        return base;
    }
    const rejected = new Set(validateSettings(stored).map((i) => i.field.split(/[.[]/)[0]));
    const clean = {};
    for (const [field, value] of Object.entries(stored)) {
        if (!rejected.has(field))
            clean[field] = value;
    }
    return mergeSettings(base, clean);
}
//# sourceMappingURL=requirement-settings.js.map