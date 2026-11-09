"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCatalogue = buildCatalogue;
exports.concreteKeys = concreteKeys;
exports.allGrantableKeys = allGrantableKeys;
exports.expandGrants = expandGrants;
exports.toMatrix = toMatrix;
exports.invalidKeys = invalidKeys;
const permission_catalogue_1 = require("src/modules/permission/domain/permission-catalogue");
function buildCatalogue() {
    const byResource = new Map();
    for (const perm of permission_catalogue_1.PERMISSIONS) {
        if (perm.key === '*' || perm.key.endsWith('.*'))
            continue;
        const [resource, action] = perm.key.split('.');
        if (!resource || !action)
            continue;
        let entry = byResource.get(resource);
        if (!entry) {
            entry = { group: perm.group, resource, actions: [] };
            byResource.set(resource, entry);
        }
        if (!entry.actions.includes(action))
            entry.actions.push(action);
    }
    return [...byResource.values()];
}
function concreteKeys() {
    return permission_catalogue_1.PERMISSIONS.map((p) => p.key).filter((k) => k !== '*' && !k.endsWith('.*'));
}
function allGrantableKeys() {
    return new Set(permission_catalogue_1.PERMISSIONS.map((p) => p.key));
}
function expandGrants(grantedKeys) {
    const granted = new Set(grantedKeys);
    const effective = new Set();
    for (const key of concreteKeys()) {
        const [resource] = key.split('.');
        if (granted.has('*') || granted.has(`${resource}.*`) || granted.has(key)) {
            effective.add(key);
        }
    }
    return effective;
}
function toMatrix(grantedKeys) {
    const effective = expandGrants(grantedKeys);
    const matrix = {};
    for (const { resource, actions } of buildCatalogue()) {
        matrix[resource] = {};
        for (const action of actions) {
            matrix[resource][action] = effective.has(`${resource}.${action}`);
        }
    }
    return matrix;
}
function invalidKeys(keys) {
    const valid = allGrantableKeys();
    return keys.filter((k) => !valid.has(k));
}
//# sourceMappingURL=permission-matrix.js.map