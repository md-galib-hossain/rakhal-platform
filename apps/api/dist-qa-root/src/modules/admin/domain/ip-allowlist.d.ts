export declare function normalizeIp(ip: string | undefined | null): string;
export declare function parseAllowlist(raw: string | undefined): string[];
export declare function isIpAllowed(ip: string | undefined | null, allowlist: readonly string[]): boolean;
