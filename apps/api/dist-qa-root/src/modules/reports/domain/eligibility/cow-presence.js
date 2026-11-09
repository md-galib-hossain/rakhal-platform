"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluatePresence = evaluatePresence;
exports.isPresentDuring = isPresentDuring;
const civilDate = (d) => d.toISOString().slice(0, 10);
function evaluatePresence(cow, period, generatedAt = new Date()) {
    const entrySource = cow.enteredAt ? 'enteredAt' : 'createdAt';
    const result = (present, reason) => ({ present, entrySource, reason });
    if (cow.deletedAt && cow.deletedAt.getTime() <= generatedAt.getTime())
        return result(false, 'deleted');
    const { startDate, endDate } = period;
    const enteredAfter = cow.enteredAt && endDate !== undefined
        ? civilDate(cow.enteredAt) > endDate
        : (cow.enteredAt ?? cow.createdAt).getTime() >= period.end.getTime();
    if (enteredAfter)
        return result(false, 'entered_after_period');
    let exitedBefore = false;
    if (cow.dispositionDate) {
        exitedBefore =
            startDate !== undefined
                ? civilDate(cow.dispositionDate) < startDate
                : cow.dispositionDate.getTime() < period.start.getTime();
    }
    if (exitedBefore)
        return result(false, 'exited_before_period');
    return result(true, null);
}
function isPresentDuring(cow, period, generatedAt = new Date()) {
    return evaluatePresence(cow, period, generatedAt).present;
}
//# sourceMappingURL=cow-presence.js.map