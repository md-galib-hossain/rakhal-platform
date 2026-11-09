"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_PAYLOAD_BYTES = exports.MAX_CUSTOM_FIELDS = exports.CUSTOM_GROUPS = void 0;
exports.validateFields = validateFields;
exports.normalizeAppliesTo = normalizeAppliesTo;
exports.validateCustomPayload = validateCustomPayload;
exports.toDefinition = toDefinition;
const catalogue_1 = require("./catalogue");
exports.CUSTOM_GROUPS = [
    'HEALTH',
    'REPRODUCTION',
    'GROWTH',
    'MOVEMENT',
    'OTHER',
];
exports.MAX_CUSTOM_FIELDS = 20;
exports.MAX_PAYLOAD_BYTES = 4096;
const KEY = /^[a-z][a-zA-Z0-9_]{0,39}$/;
function validateFields(fields) {
    if (!Array.isArray(fields))
        return ['fields must be a list'];
    if (fields.length > exports.MAX_CUSTOM_FIELDS)
        return [`at most ${exports.MAX_CUSTOM_FIELDS} fields`];
    const problems = [];
    const seen = new Set();
    fields.forEach((f, i) => {
        if (!f || typeof f.key !== 'string' || !KEY.test(f.key))
            problems.push(`fields[${i}].key must match ${KEY}`);
        else if (seen.has(f.key))
            problems.push(`fields[${i}].key is repeated`);
        else
            seen.add(f.key);
        if (!f?.label || typeof f.label !== 'string' || f.label.length > 60)
            problems.push(`fields[${i}].label is required (max 60)`);
        if (!f?.kind || !['number', 'text', 'select'].includes(f.kind))
            problems.push(`fields[${i}].kind must be number, text or select`);
        if (f?.kind === 'select' &&
            (!Array.isArray(f.options) || f.options.length < 1))
            problems.push(`fields[${i}].options is required for a select`);
    });
    return problems;
}
function normalizeAppliesTo(raw) {
    const out = {};
    const given = (raw && typeof raw === 'object' ? raw : {});
    for (const chip of catalogue_1.EVENT_CHIPS) {
        const v = given[chip] ?? 'LISTED';
        if (v !== 'LISTED' && v !== 'WARN' && v !== 'BLOCK')
            return null;
        out[chip] = v;
    }
    return out;
}
function validateCustomPayload(fields, payload) {
    const problems = [];
    if (JSON.stringify(payload).length > exports.MAX_PAYLOAD_BYTES)
        problems.push('payload exceeds 4 KB');
    for (const f of fields) {
        const v = payload[f.key];
        if (v === undefined || v === null || v === '') {
            if (f.required)
                problems.push(`${f.key} is required`);
            continue;
        }
        if (f.kind === 'number' && typeof v !== 'number')
            problems.push(`${f.key} must be a number`);
        if (f.kind === 'text' && typeof v !== 'string')
            problems.push(`${f.key} must be text`);
        if (f.kind === 'select' &&
            !(typeof v === 'string' && (f.options ?? []).includes(v)))
            problems.push(`${f.key} must be one of ${(f.options ?? []).join(', ')}`);
    }
    for (const k of Object.keys(payload)) {
        if (!fields.some((f) => f.key === k))
            problems.push(`${k} is not a field`);
    }
    return problems;
}
function toDefinition(row) {
    return {
        type: 'CUSTOM',
        group: row.group,
        labelKey: row.name,
        detailTable: null,
        appliesTo: normalizeAppliesTo(row.appliesTo) ??
            normalizeAppliesTo({}),
        hardRules: ['NOT_BEFORE_BIRTH', 'NOT_FUTURE', 'NOT_AFTER_EXIT'],
        permission: 'cattle.update',
        allowsHistorical: true,
        followUps: [],
    };
}
//# sourceMappingURL=custom-type.js.map