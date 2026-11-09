"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyDelta = classifyDelta;
exports.computeProgramFit = computeProgramFit;
exports.remainingRequirement = remainingRequirement;
exports.computeRemainingFit = computeRemainingFit;
exports.toApiFit = toApiFit;
exports.bandsFromSettings = bandsFromSettings;
const RANK = { ok: 0, warn: 1, bad: 2 };
const round1 = (v) => Math.round(v * 10) / 10;
function classifyDelta(supply, requirement, belowPct, abovePct) {
    if (!(requirement > 0))
        return { deltaPct: null, severity: 'ok' };
    const delta = round1((supply / requirement - 1) * 100);
    let severity = 'ok';
    if (delta < -belowPct) {
        severity = -delta <= belowPct * 2 ? 'warn' : 'bad';
    }
    else if (delta > abovePct) {
        severity = delta <= abovePct * 2 ? 'warn' : 'bad';
    }
    return { deltaPct: delta, severity };
}
function computeProgramFit(supply, requirement, bands, estimated) {
    const dm = classifyDelta(supply.dmKg, requirement.dmKg, bands.dmBelowPct, bands.dmAbovePct);
    const cp = classifyDelta(supply.cpKg, requirement.cpKg, bands.cpBelowPct, bands.cpAbovePct);
    const me = classifyDelta(supply.meMj, requirement.meMj, bands.meBelowPct, bands.meAbovePct);
    const severity = [dm, cp, me].reduce((worst, n) => (RANK[n.severity] > RANK[worst] ? n.severity : worst), 'ok');
    return { dm, cp, me, severity, estimated };
}
function remainingRequirement(requirement, fed) {
    return {
        dmKg: Math.max(0, requirement.dmKg - fed.dmKg),
        cpKg: Math.max(0, requirement.cpKg - fed.cpKg),
        meMj: Math.max(0, requirement.meMj - fed.meMj),
    };
}
function computeRemainingFit(supply, requirement, fed, bands, estimated) {
    const fit = computeProgramFit(supply, remainingRequirement(requirement, fed), bands, estimated);
    const met = (s, r, f) => r > 0 && f >= r && s > 0;
    if (met(supply.dmKg, requirement.dmKg, fed.dmKg)) {
        fit.dm = { deltaPct: null, severity: 'warn' };
    }
    if (met(supply.cpKg, requirement.cpKg, fed.cpKg)) {
        fit.cp = { deltaPct: null, severity: 'warn' };
    }
    if (met(supply.meMj, requirement.meMj, fed.meMj)) {
        fit.me = { deltaPct: null, severity: 'warn' };
    }
    fit.severity = [fit.dm, fit.cp, fit.me].reduce((worst, n) => (RANK[n.severity] > RANK[worst] ? n.severity : worst), 'ok');
    return fit;
}
function toApiFit(f) {
    const n = (x) => ({
        delta_pct: x.deltaPct,
        severity: x.severity,
    });
    return {
        severity: f.severity,
        estimated: f.estimated,
        dm: n(f.dm),
        cp: n(f.cp),
        me: n(f.me),
    };
}
function bandsFromSettings(s) {
    return {
        dmBelowPct: s.alertDryMatterBelowPct,
        dmAbovePct: s.alertDryMatterAbovePct,
        cpBelowPct: s.alertProteinBelowPct,
        cpAbovePct: s.alertProteinAbovePct,
        meBelowPct: s.alertEnergyBelowPct,
        meAbovePct: s.alertEnergyAbovePct,
    };
}
//# sourceMappingURL=program-fit.js.map