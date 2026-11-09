"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.historyEvent = historyEvent;
const client_1 = require("@prisma/client");
function historyEvent(h) {
    const date = h.date ?? new Date().toISOString();
    switch (h.kind) {
        case 'LAST_CALVING':
            return {
                type: 'CALVING',
                eventAt: date,
                payload: {
                    calvingEase: 'NORMAL',
                    ...(h.calvingNumber ? { calvingNumber: h.calvingNumber } : {}),
                },
            };
        case 'LAST_BREEDING':
            return {
                type: 'BREEDING',
                eventAt: date,
                payload: {
                    breedingMethod: h.method ?? client_1.BreedingMethod.AI,
                    ...(h.bull ? { sireNameOrCode: h.bull } : {}),
                },
            };
        case 'PREGNANT':
            return {
                type: 'PREG_CHECK',
                eventAt: new Date().toISOString(),
                payload: {
                    ...(h.expectedCalvingDate
                        ? { expectedCalvingDate: h.expectedCalvingDate }
                        : {}),
                    ...(h.monthsPregnant ? { gestationDay: h.monthsPregnant * 30 } : {}),
                },
            };
        case 'LAST_VACCINATION':
            return {
                type: 'VACCINATION',
                eventAt: date,
                payload: {
                    medicineName: h.product ?? 'vaccine',
                    outsideInventory: true,
                    doseAmount: 1,
                    doseUnit: 'dose',
                    route: 'SC',
                },
            };
        default:
            return null;
    }
}
//# sourceMappingURL=history-event.js.map