"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeIp = normalizeIp;
exports.parseAllowlist = parseAllowlist;
exports.isIpAllowed = isIpAllowed;
const net_1 = require("net");
function normalizeIp(ip) {
    const value = (ip ?? '').trim().toLowerCase();
    return value.startsWith('::ffff:') && (0, net_1.isIPv4)(value.slice(7))
        ? value.slice(7)
        : value;
}
function parseAllowlist(raw) {
    return (raw ?? '')
        .split(',')
        .map((entry) => normalizeIp(entry))
        .filter((entry) => entry.length > 0);
}
function ipv4ToInt(ip) {
    return ip
        .split('.')
        .reduce((acc, octet) => ((acc << 8) | Number(octet)) >>> 0, 0);
}
function matchesCidr(ip, cidr) {
    const [base, bitsRaw] = cidr.split('/');
    const bits = Number(bitsRaw);
    if (!base || !(0, net_1.isIPv4)(base) || !(0, net_1.isIPv4)(ip))
        return false;
    if (!Number.isInteger(bits) || bits < 0 || bits > 32)
        return false;
    if (bits === 0)
        return true;
    const mask = (0xffffffff << (32 - bits)) >>> 0;
    return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}
function isIpAllowed(ip, allowlist) {
    if (allowlist.length === 0)
        return true;
    const client = normalizeIp(ip);
    if (!client)
        return false;
    return allowlist.some((entry) => entry.includes('/') ? matchesCidr(client, entry) : entry === client);
}
//# sourceMappingURL=ip-allowlist.js.map