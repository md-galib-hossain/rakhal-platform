"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CALF_CARE_SCHEDULE = void 0;
exports.buildCalfCareSchedule = buildCalfCareSchedule;
const client_1 = require("@prisma/client");
const calf_stage_1 = require("./calf-stage");
exports.CALF_CARE_SCHEDULE = [
    {
        key: 'neonatal_care',
        name: 'Neonatal care',
        details: 'Day 1 neonatal care: navel dipping, ensure colostrum intake, check vitals.',
        offsetDays: 1,
    },
    {
        key: 'first_deworming',
        name: 'First deworming',
        details: 'Day 7 first deworming for the calf.',
        offsetDays: 7,
    },
    {
        key: 'fmd_vaccination',
        name: 'First FMD vaccination',
        details: 'Day 14 first FMD (foot-and-mouth disease) vaccination.',
        offsetDays: 14,
    },
    {
        key: 'brucellosis_vaccination',
        name: 'Brucellosis vaccination',
        details: 'Day 21 brucellosis vaccination (female calves only).',
        offsetDays: 21,
        femaleOnly: true,
    },
    {
        key: 'one_month_checkup',
        name: 'One-month check-up',
        details: 'Month 1 routine check-up: weight, growth and health review.',
        offsetDays: 30,
    },
    {
        key: 'three_month_booster',
        name: 'Three-month booster',
        details: 'Month 3 booster vaccinations.',
        offsetDays: 90,
    },
];
function buildCalfCareSchedule(birthDate, gender) {
    return exports.CALF_CARE_SCHEDULE.filter((entry) => !entry.femaleOnly || gender === client_1.CattleGender.FEMALE).map((entry) => ({
        key: entry.key,
        name: entry.name,
        details: entry.details,
        offsetDays: entry.offsetDays,
        dueAt: new Date(birthDate.getTime() + entry.offsetDays * calf_stage_1.DAY_MS),
    }));
}
//# sourceMappingURL=calf-care-schedule.js.map