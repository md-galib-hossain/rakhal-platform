"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rulesCompletedBy = exports.ruleByKey = exports.FOLLOW_UP_RULES = void 0;
exports.planFollowUps = planFollowUps;
const DAY_MS = 24 * 60 * 60 * 1000;
const plus = (d, days) => new Date(d.getTime() + days * DAY_MS);
const positive = (e) => e.result === 'PREGNANT' || e.result === undefined;
exports.FOLLOW_UP_RULES = [
    {
        key: 'BREEDING_TO_PREG_CHECK',
        title: 'Pregnancy check',
        kind: 'TASK',
        defaultOn: true,
        trigger: 'BREEDING',
        completesOn: ['PREG_CHECK'],
        defaultOffsetDays: (d) => d.pregnancyCheckDays,
        matches: () => true,
        due: (e, o) => plus(e.eventAt, o ?? 35),
    },
    {
        key: 'PREG_POSITIVE_TO_DRY_OFF',
        title: 'Dry off',
        kind: 'TASK',
        defaultOn: true,
        trigger: 'PREG_CHECK',
        completesOn: ['DRY_OFF', 'CALVING'],
        defaultOffsetDays: (d) => d.dryPeriodDays,
        matches: (e) => positive(e) && Boolean(e.expectedCalvingDate),
        due: (e, o) => e.expectedCalvingDate ? plus(e.expectedCalvingDate, -(o ?? 60)) : null,
    },
    {
        key: 'PREG_POSITIVE_TO_CALVING_WATCH',
        title: 'Calving watch',
        kind: 'TASK',
        defaultOn: true,
        trigger: 'PREG_CHECK',
        completesOn: ['CALVING'],
        defaultOffsetDays: (d) => d.closeUpDays,
        matches: (e) => positive(e) && Boolean(e.expectedCalvingDate),
        due: (e, o) => e.expectedCalvingDate ? plus(e.expectedCalvingDate, -(o ?? 21)) : null,
    },
    {
        key: 'CALVING_TO_VWP_END',
        title: 'Voluntary waiting period ends: ready to breed',
        kind: 'TASK',
        defaultOn: true,
        trigger: 'CALVING',
        completesOn: ['BREEDING'],
        defaultOffsetDays: (d) => d.vwpDays,
        matches: () => true,
        due: (e, o) => plus(e.eventAt, o ?? 60),
    },
    {
        key: 'SUSPECTED_TO_RECHECK',
        title: 'Pregnancy recheck',
        kind: 'TASK',
        defaultOn: true,
        trigger: 'PREG_CHECK',
        completesOn: ['PREG_CHECK'],
        defaultOffsetDays: () => 10,
        matches: (e) => e.result === 'SUSPECTED',
        due: (e, o) => plus(e.eventAt, o ?? 10),
    },
    {
        key: 'VACCINATION_NEXT_DOSE',
        title: 'Next vaccine dose',
        kind: 'TASK',
        defaultOn: true,
        trigger: 'VACCINATION',
        completesOn: ['VACCINATION'],
        defaultOffsetDays: () => null,
        matches: (e) => Number(e.payload.nextDoseDays) > 0,
        due: (e) => plus(e.eventAt, Number(e.payload.nextDoseDays)),
    },
    {
        key: 'HEAT_TO_BREED_SUGGESTION',
        title: 'Breed in the next 12–18 hours',
        kind: 'SUGGESTION',
        defaultOn: true,
        trigger: 'HEAT',
        completesOn: ['BREEDING'],
        defaultOffsetDays: () => 0.5,
        matches: () => true,
        due: (e, o) => plus(e.eventAt, o ?? 0.5),
    },
];
const ruleByKey = (key) => exports.FOLLOW_UP_RULES.find((r) => r.key === key);
exports.ruleByKey = ruleByKey;
function planFollowUps(event, defaults, overrides, now) {
    const out = [];
    for (const rule of exports.FOLLOW_UP_RULES) {
        if (rule.trigger !== event.type || !rule.matches(event))
            continue;
        const o = overrides[rule.key];
        if (o?.enabled === false)
            continue;
        const offset = o?.offsetDays ?? rule.defaultOffsetDays(defaults);
        const dueDate = rule.due(event, offset);
        if (!dueDate)
            continue;
        out.push({
            ruleKey: rule.key,
            title: rule.title,
            kind: rule.kind,
            dueDate,
            defaultOn: rule.defaultOn,
            pastDue: rule.kind === 'TASK' && dueDate.getTime() < now.getTime(),
        });
    }
    return out;
}
const rulesCompletedBy = (type) => exports.FOLLOW_UP_RULES.filter((r) => r.completesOn.includes(type)).map((r) => r.key);
exports.rulesCompletedBy = rulesCompletedBy;
//# sourceMappingURL=follow-up-rules.js.map