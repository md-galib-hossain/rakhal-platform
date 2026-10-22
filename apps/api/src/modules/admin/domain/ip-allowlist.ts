import { isIPv4 } from 'net';

/**
 * Admin IP allowlist (P2-06). Entries are exact IPs (v4 or v6) or IPv4 CIDRs
 * (`203.0.113.0/24`). Empty list = feature off. Pure so it is unit-testable.
 */

/** `::ffff:1.2.3.4` (how Node reports a v4 client on a dual-stack socket) -> `1.2.3.4`. */
export function normalizeIp(ip: string | undefined | null): string {
  const value = (ip ?? '').trim().toLowerCase();
  return value.startsWith('::ffff:') && isIPv4(value.slice(7))
    ? value.slice(7)
    : value;
}

export function parseAllowlist(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((entry) => normalizeIp(entry))
    .filter((entry) => entry.length > 0);
}

function ipv4ToInt(ip: string): number {
  return ip
    .split('.')
    .reduce((acc, octet) => ((acc << 8) | Number(octet)) >>> 0, 0);
}

function matchesCidr(ip: string, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split('/');
  const bits = Number(bitsRaw);
  if (!base || !isIPv4(base) || !isIPv4(ip)) return false;
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

/** True when the allowlist is empty (disabled) or the IP matches an entry. */
export function isIpAllowed(
  ip: string | undefined | null,
  allowlist: readonly string[],
): boolean {
  if (allowlist.length === 0) return true;
  const client = normalizeIp(ip);
  if (!client) return false;
  return allowlist.some((entry) =>
    entry.includes('/') ? matchesCidr(client, entry) : entry === client,
  );
}
