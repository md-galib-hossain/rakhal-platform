"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveMilkDisposition = resolveMilkDisposition;
exports.isWithinColostrumWindow = isWithinColostrumWindow;
const client_1 = require("@prisma/client");
const DAY_MS = 24 * 60 * 60 * 1000;
function resolveMilkDisposition({ isWithheld, activeLactationStartDate, logDate, colostrumWindowDays, }) {
    if (isWithheld)
        return client_1.MilkDisposition.WITHHELD;
    if (isWithinColostrumWindow({
        activeLactationStartDate,
        asOfDate: logDate,
        colostrumWindowDays,
    })) {
        return client_1.MilkDisposition.COLOSTRUM;
    }
    return client_1.MilkDisposition.SALEABLE;
}
function isWithinColostrumWindow({ activeLactationStartDate, asOfDate, colostrumWindowDays, }) {
    if (!activeLactationStartDate)
        return false;
    const daysSinceStart = Math.floor((asOfDate.getTime() - activeLactationStartDate.getTime()) / DAY_MS);
    return daysSinceStart >= 0 && daysSinceStart < colostrumWindowDays;
}
//# sourceMappingURL=milk-disposition.js.map