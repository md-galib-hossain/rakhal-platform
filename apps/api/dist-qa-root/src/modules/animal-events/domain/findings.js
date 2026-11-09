"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFindings = buildFindings;
const BLOCK_CODES = {
    FEMALE_ONLY: 'EVENT_WRONG_SEX',
    MALE_ONLY: 'EVENT_WRONG_SEX',
    DATE_IN_FUTURE: 'EVENT_DATE_IN_FUTURE',
    DATE_BEFORE_BIRTH: 'EVENT_DATE_BEFORE_BIRTH',
    ANIMAL_LEFT_HERD: 'EVENT_AFTER_EXIT',
    REQUIRES_FATTENING: 'EVENT_PRECONDITION_FAILED',
};
function buildFindings(def, eligibility, facts) {
    const out = [];
    const add = (code, severity) => {
        if (!out.some((f) => f.code === code))
            out.push({ code, severity });
    };
    for (const f of eligibility.findings) {
        const blockCode = BLOCK_CODES[f.code];
        if (blockCode)
            add(blockCode, 'BLOCK');
    }
    const has = (c) => facts.categories.includes(c);
    switch (def.type) {
        case 'HEAT':
            if (has('PREGNANT'))
                add('HEAT_WHILE_PREGNANT', 'WARN');
            break;
        case 'BREEDING':
            if (has('PREGNANT'))
                add('BREEDING_WHILE_PREGNANT', 'WARN');
            break;
        case 'PREG_CHECK':
            if (!facts.breedingGiven && !facts.hasPendingBreeding)
                add('PREG_CHECK_NO_BREEDING', 'WARN');
            break;
        case 'CALVING':
            if (!has('PREGNANT'))
                add('CALVING_NO_PREGNANCY', 'WARN');
            break;
        case 'DRY_OFF':
            if (!has('MILKING'))
                add('DRY_OFF_NO_LACTATION', 'WARN');
            if (has('DRY'))
                add('DRY_OFF_ALREADY_DRY', 'WARN');
            break;
        case 'ENTER_FATTENING':
            if (has('FATTENING'))
                add('ALREADY_IN_FATTENING', 'WARN');
            break;
        default:
            break;
    }
    if (!out.length) {
        for (const f of eligibility.findings) {
            if (f.code.startsWith('NOT_FOR_') || f.code.startsWith('UNUSUAL_FOR_')) {
                add(`${def.type}_${f.code}`, 'WARN');
            }
        }
    }
    return out;
}
//# sourceMappingURL=findings.js.map