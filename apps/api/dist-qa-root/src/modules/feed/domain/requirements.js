"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MJ_PER_MCAL = void 0;
exports.computeRequirements = computeRequirements;
const requirement_settings_1 = require("./requirement-settings");
exports.MJ_PER_MCAL = 4.184;
const round = (v) => Math.round(v * 100) / 100;
function pregnancyDmPctBw(gestationDays, settings) {
    if (gestationDays == null || gestationDays <= 0)
        return 0;
    const stages = settings.pregnancyIntakeStages;
    const stage = stages.find((s) => gestationDays <= s.untilDay);
    return stage
        ? stage.percentOfBodyWeight
        : stages[stages.length - 1].percentOfBodyWeight;
}
function gestationCurveFraction(gestationDays, settings) {
    if (gestationDays == null || gestationDays <= 0)
        return 0;
    const clamped = Math.min(gestationDays, settings.pregnancyLengthDays);
    return Math.pow(clamped / settings.pregnancyLengthDays, 2);
}
function bcsMeMultiplier(bcs, settings) {
    if (bcs == null)
        return 1;
    const deviationQuarters = (settings.targetBodyCondition - bcs) / 0.25;
    return Math.max(0, 1 + deviationQuarters * settings.energyAdjustPerBodyConditionStep);
}
function bcsDmAdjustmentKg(bcs, settings) {
    if (bcs == null)
        return 0;
    return ((settings.targetBodyCondition - bcs) *
        settings.intakeAdjustPerBodyConditionPoint);
}
function computeRequirements(input, settings = requirement_settings_1.DEFAULT_REQUIREMENT_SETTINGS) {
    const bw = Math.max(0, input.weightKg);
    const milk = Math.max(0, input.milkTargetL);
    const fat = input.milkFatPct ?? 4.0;
    const dim = input.dim ?? settings.defaultDaysInMilk;
    const animalType = input.animalType ?? 'COW';
    const metabolicWeight = Math.pow(bw, 0.75);
    const fcm4 = 0.4 * milk + (15 * (milk * fat)) / 100;
    const lactationCurve = 1 -
        Math.exp(-settings.intakeCurveSteepness * (dim / 7 + settings.intakeCurveOffset));
    const dmLactation = (settings.intakeFromMilkFactor * fcm4 +
        settings.intakeFromBodyWeightFactor * metabolicWeight) *
        lactationCurve;
    const dmPregnancy = pregnancyDmPctBw(input.gestationDays, settings) * bw;
    const dmHeiferGrowth = animalType === 'HEIFER' ? settings.heiferIntakePercentOfBodyWeight * bw : 0;
    const bcsAdjustmentKg = bcsDmAdjustmentKg(input.bcs, settings);
    const dmKg = Math.max(0, Math.max(dmLactation, dmPregnancy, dmHeiferGrowth) + bcsAdjustmentKg);
    const gestationFraction = gestationCurveFraction(input.gestationDays, settings);
    const mePerLitre = settings.energyPerLitreMilk + (fat - 4) * settings.energyPerMilkFatPercent;
    const meMaintenance = settings.maintenanceEnergyPerMetabolicKg *
        metabolicWeight *
        bcsMeMultiplier(input.bcs, settings);
    const meMilk = mePerLitre * milk;
    const mePregnancy = settings.pregnancyPeakEnergy * gestationFraction;
    const meHeiferGrowth = animalType === 'HEIFER' ? settings.heiferGrowthEnergy : 0;
    const meMj = meMaintenance + meMilk + mePregnancy + meHeiferGrowth;
    const cpMaintenanceKg = (settings.maintenanceProteinPerMetabolicKg * metabolicWeight) / 1000;
    const cpMilkKg = (settings.proteinPerLitreMilk * milk) / 1000;
    const cpPregnancyKg = settings.pregnancyPeakProtein * gestationFraction;
    const cpHeiferGrowthKg = animalType === 'HEIFER' ? settings.heiferGrowthProtein : 0;
    const cpKg = cpMaintenanceKg + cpMilkKg + cpPregnancyKg + cpHeiferGrowthKg;
    const ndfKg = settings.ndfMinShareOfIntake * dmKg;
    const ndfMaxKg = settings.ndfMaxShareOfIntake * dmKg;
    const fatKg = settings.fatShareOfIntake * dmKg;
    const adfKg = settings.adfShareOfIntake * dmKg;
    const tdnKg = settings.tdnShareOfIntake * dmKg;
    const calciumKg = (settings.calciumPerBodyWeightKg * bw +
        settings.calciumPerLitreMilk * milk) /
        1000;
    const phosphorusKg = (settings.phosphorusPerBodyWeightKg * bw +
        settings.phosphorusPerLitreMilk * milk) /
        1000;
    const cpPctOfDm = dmKg > 0 ? (cpKg / dmKg) * 100 : 0;
    const energyDensityMjPerKgDm = dmKg > 0 ? meMj / dmKg : 0;
    const neMcal = (meMj / exports.MJ_PER_MCAL) * settings.netEnergyEfficiency;
    return {
        dmKg: round(dmKg),
        cpKg: round(cpKg),
        meMj: round(meMj),
        ndfKg: round(ndfKg),
        fatKg: round(fatKg),
        neMcal: round(neMcal),
        energyDensityMjPerKgDm: round(energyDensityMjPerKgDm),
        cpPctOfDm: round(cpPctOfDm),
        tdnKg: round(tdnKg),
        calciumKg: round(calciumKg),
        phosphorusKg: round(phosphorusKg),
        adfKg: round(adfKg),
        rdpPct: settings.degradableProteinShare,
        rupPct: settings.undegradableProteinShare,
        ndfMaxKg: round(ndfMaxKg),
        caPRatioTarget: settings.calciumToPhosphorusTarget,
        breakdown: {
            dm: {
                lactation: round(dmLactation),
                pregnancy: round(dmPregnancy),
                heiferGrowth: round(dmHeiferGrowth),
                bcsAdjustment: round(bcsAdjustmentKg),
            },
            me: {
                maintenance: round(meMaintenance),
                milk: round(meMilk),
                pregnancy: round(mePregnancy),
                heiferGrowth: round(meHeiferGrowth),
            },
            cp: {
                maintenance: round(cpMaintenanceKg),
                milk: round(cpMilkKg),
                pregnancy: round(cpPregnancyKg),
                heiferGrowth: round(cpHeiferGrowthKg),
            },
        },
    };
}
//# sourceMappingURL=requirements.js.map