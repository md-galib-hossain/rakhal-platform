"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveBreedingStatus = deriveBreedingStatus;
const client_1 = require("@prisma/client");
function deriveBreedingStatus(facts) {
    if (facts.hasCalving)
        return client_1.BreedingStatus.CALVED;
    if (facts.hasAbortion)
        return client_1.BreedingStatus.ABORTED;
    if (facts.hasActivePregnancy)
        return client_1.BreedingStatus.PREGNANT;
    if (facts.hasFailedDiagnosis)
        return client_1.BreedingStatus.FAILED;
    if (facts.hasReturnedToHeat)
        return client_1.BreedingStatus.RETURNED_TO_HEAT;
    return client_1.BreedingStatus.PENDING_CHECK;
}
//# sourceMappingURL=breeding-status.js.map