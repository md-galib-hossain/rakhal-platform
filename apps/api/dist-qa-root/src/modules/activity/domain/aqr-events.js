"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AQR_EVENTS = exports.AQR_DEFAULT_BOUNDS = void 0;
const client_1 = require("@prisma/client");
exports.AQR_DEFAULT_BOUNDS = { min: 0, max: 100 };
exports.AQR_EVENTS = {
    animal_registered: {
        delta: 50,
        module: client_1.ActivityLogModule.COW_MANAGEMENT,
        title: 'Animal Registered',
    },
    milk_session_logged: {
        delta: 0.5,
        module: client_1.ActivityLogModule.MILK_PRODUCTION,
        title: 'Milk Session Logged',
    },
    sickness_reported: {
        delta: -10,
        module: client_1.ActivityLogModule.HEALTH_SAFETY,
        title: 'Animal Sickness Reported',
    },
    preventive_care_logged: {
        delta: 0,
        module: client_1.ActivityLogModule.HEALTH_SAFETY,
        title: 'Preventive Care Logged',
    },
    recovered: {
        delta: 5,
        module: client_1.ActivityLogModule.HEALTH_SAFETY,
        title: 'Animal Recovered',
    },
    mortality: {
        delta: 0,
        nullify: true,
        module: client_1.ActivityLogModule.HEALTH_SAFETY,
        title: 'Animal Mortality',
    },
    calving_successful: {
        delta: 8,
        module: client_1.ActivityLogModule.BREEDING,
        title: 'Calving Recorded',
    },
    pregnancy_confirmed: {
        delta: 5,
        module: client_1.ActivityLogModule.BREEDING,
        title: 'Pregnancy Confirmed',
    },
    treatment_completed: {
        delta: 3,
        module: client_1.ActivityLogModule.HEALTH_SAFETY,
        title: 'Treatment Completed',
    },
};
//# sourceMappingURL=aqr-events.js.map