"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateEligibility = evaluateEligibility;
const catalogue_1 = require("../catalogue");
const categories_1 = require("./categories");
const isChip = (c) => catalogue_1.EVENT_CHIPS.includes(c);
function evaluateEligibility(def, input) {
    const { facts, ctx } = input;
    const date = input.date ?? ctx.now;
    const findings = [];
    const block = (code) => findings.push({ code, severity: 'BLOCK' });
    if (def.hardRules.includes('FEMALE_ONLY') && facts.gender !== 'FEMALE')
        block('FEMALE_ONLY');
    if (def.hardRules.includes('MALE_ONLY') && facts.gender === 'FEMALE')
        block('MALE_ONLY');
    if (def.hardRules.includes('NOT_FUTURE') &&
        date.getTime() > ctx.now.getTime())
        block('DATE_IN_FUTURE');
    if (def.hardRules.includes('NOT_BEFORE_BIRTH') &&
        facts.dateOfBirth &&
        date.getTime() < facts.dateOfBirth.getTime())
        block('DATE_BEFORE_BIRTH');
    if (def.hardRules.includes('NOT_AFTER_EXIT') && input.leftHerd)
        block('ANIMAL_LEFT_HERD');
    const chips = (0, categories_1.categoriesOf)(facts, ctx).filter(isChip);
    let level = 'LISTED';
    if (def.requiresChip) {
        if (!chips.includes(def.requiresChip)) {
            level = 'BLOCK';
            block(`REQUIRES_${def.requiresChip}`);
        }
    }
    else {
        for (const chip of chips) {
            const v = def.appliesTo[chip];
            if (v === 'BLOCK') {
                level = 'BLOCK';
                findings.push({ code: `NOT_FOR_${chip}`, severity: 'BLOCK' });
            }
            else if (v === 'WARN' && level !== 'BLOCK') {
                level = 'WARN';
                findings.push({ code: `UNUSUAL_FOR_${chip}`, severity: 'WARN' });
            }
        }
    }
    if (findings.some((f) => f.severity === 'BLOCK'))
        level = 'BLOCK';
    return {
        type: def.type,
        eligible: level !== 'BLOCK',
        level,
        findings,
    };
}
//# sourceMappingURL=evaluate.js.map