/** Parser + differ for web CSS custom-property colour tokens. Pure functions. */

export interface WebTokens {
  /** :root hex declarations, normalised to lowercase 6/8-digit hex. */
  light: Record<string, string>;
  /** .dark hex declarations (overrides only; resolve with resolveDark). */
  dark: Record<string, string>;
  /** Declarations whose value is not a hex literal (oklch, hsl, rgb, var, lengths...), by block, raw text. */
  unsupported: { light: Record<string, string>; dark: Record<string, string> };
}

/** camelCase token name -> CSS custom property name (primaryForeground -> --primary-foreground, chart1 -> --chart-1). */
export function toCssVar(name: string): string {
  return '--' + name.replace(/([A-Z])/g, (_, c: string) => '-' + c.toLowerCase()).replace(/([a-z])(\d)/g, '$1-$2');
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Lowercase, and expand 3/4-digit shorthand to 6/8 digits. Caller checks HEX first. */
export function normalizeHex(hex: string): string {
  let h = hex.trim().toLowerCase();
  if (h.length === 4 || h.length === 5) h = '#' + h.slice(1).split('').map((c) => c + c).join('');
  return h;
}

/**
 * Collect `--name: value` declarations from every top-level `:root { }` and `.dark { }` block.
 * The last declaration may omit its trailing semicolon. Non-hex values are kept in `unsupported`.
 */
export function parseWebTokens(css: string): WebTokens {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const result: WebTokens = { light: {}, dark: {}, unsupported: { light: {}, dark: {} } };
  const blockRe = /(?<![\w\-.#:\]])(:root|\.dark)\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(stripped))) {
    const key = m[1] === ':root' ? 'light' : 'dark';
    const declRe = /(--[a-z0-9-]+)\s*:\s*([^;]+?)\s*(?:;|$)/gi;
    let d: RegExpExecArray | null;
    while ((d = declRe.exec(m[2]!))) {
      const name = d[1]!;
      const value = d[2]!.trim();
      if (HEX.test(value)) {
        result[key][name] = normalizeHex(value);
        delete result.unsupported[key][name];
      } else {
        result.unsupported[key][name] = value;
        delete result[key][name];
      }
    }
  }
  return result;
}

type Lookup = { hex: string } | { unsupported: string } | null;

function lookup(web: WebTokens, theme: 'light' | 'dark', cssVar: string): Lookup {
  const own = (t: 'light' | 'dark'): Lookup => {
    if (web.unsupported[t][cssVar] !== undefined) return { unsupported: web.unsupported[t][cssVar]! };
    if (web[t][cssVar] !== undefined) return { hex: web[t][cssVar]! };
    return null;
  };
  // Dark as the browser sees it: a .dark declaration (hex or not) wins, else inherit :root.
  return theme === 'light' ? own('light') : (own('dark') ?? own('light'));
}

/** Dark theme as the browser sees it for hex values: :root overlaid with .dark (a non-hex .dark override removes the value). */
export function resolveDark(web: WebTokens): Record<string, string> {
  const out = { ...web.light, ...web.dark };
  for (const k of Object.keys(web.unsupported.dark)) delete out[k];
  return out;
}

export interface Drift {
  theme: 'light' | 'dark';
  token: string;
  cssVar: string;
  mobile: string;
  /** Web hex, or null when missing or not a hex literal (see `unsupported`). */
  web: string | null;
  /** Raw web value when the variable exists but is not a hex literal. */
  unsupported?: string;
}

/** Compare mobile tokens with web values. `web: null` means missing (or unsupported, with `unsupported` set). */
export function diffTokens(
  mobile: { light: Record<string, string>; dark: Record<string, string> },
  web: WebTokens,
): Drift[] {
  const drifts: Drift[] = [];
  for (const theme of ['light', 'dark'] as const) {
    for (const [token, value] of Object.entries(mobile[theme])) {
      const cssVar = toCssVar(token);
      const found = lookup(web, theme, cssVar);
      const mobileHex = value.toLowerCase();
      if (found === null) {
        drifts.push({ theme, token, cssVar, mobile: mobileHex, web: null });
      } else if ('unsupported' in found) {
        drifts.push({ theme, token, cssVar, mobile: mobileHex, web: null, unsupported: found.unsupported });
      } else if (found.hex !== normalizeHex(mobileHex)) {
        drifts.push({ theme, token, cssVar, mobile: mobileHex, web: found.hex });
      }
    }
  }
  return drifts;
}

export function describeWeb(d: Drift): string {
  if (d.unsupported !== undefined) return `<unsupported value: ${d.unsupported}>`;
  return d.web ?? '<missing in web>';
}

export interface DivergenceEntry {
  theme: 'light' | 'dark';
  token: string;
  webHex: string;
  mobileHex: string;
}

export interface Reconciled {
  /** Drifts covered by an exact registry entry (token, theme, web value and mobile value all match). */
  accepted: Drift[];
  /** Everything else: unlisted drift, wrong mobile value, or web value changed. Must be empty to pass. */
  unexplained: Drift[];
  /** Registry entries not matched by any accepted drift (no drift left, or values changed). Must be empty to pass. */
  stale: DivergenceEntry[];
}

/** Split drifts into registry-accepted vs unexplained, and report registry entries that no longer match. */
export function reconcileDrifts(drifts: readonly Drift[], registry: readonly DivergenceEntry[]): Reconciled {
  const accepted: Drift[] = [];
  const unexplained: Drift[] = [];
  const used = new Set<DivergenceEntry>();
  for (const d of drifts) {
    const hit = registry.find(
      (e) =>
        e.theme === d.theme &&
        e.token === d.token &&
        d.web !== null &&
        normalizeHex(e.webHex) === d.web &&
        normalizeHex(e.mobileHex) === d.mobile,
    );
    if (hit) {
      accepted.push(d);
      used.add(hit);
    } else {
      unexplained.push(d);
    }
  }
  return { accepted, unexplained, stale: registry.filter((e) => !used.has(e)) };
}

export interface MobileOnlyIssue {
  theme: 'light' | 'dark';
  token: string;
  cssVar: string;
  mobile: string;
  /** conflict: the web file declares this variable with a different (or non-hex) value. overlap: also in the web-shared set. */
  kind: 'conflict' | 'overlap';
  web?: string;
}

export interface MobileOnlyReport {
  /** Must be empty to pass. */
  issues: MobileOnlyIssue[];
  /** Declared mobile-only but the web file now has the SAME value (harmless; info, owner may promote it to a shared token). */
  nowInWeb: { theme: 'light' | 'dark'; token: string; cssVar: string }[];
}

/**
 * Mobile-only tokens (src/theme/mobile-only.ts) are intentionally absent from the web file. Fails (issues) if one
 * also sits in the web-shared set `shared` (it would escape drift checking), or if the web file declares the same
 * CSS variable with a different value or a non-hex value.
 */
export function checkMobileOnly(
  mobileOnly: { light: Record<string, string>; dark: Record<string, string> },
  shared: { light: Record<string, string>; dark: Record<string, string> },
  web: WebTokens,
): MobileOnlyReport {
  const report: MobileOnlyReport = { issues: [], nowInWeb: [] };
  for (const theme of ['light', 'dark'] as const) {
    for (const [token, value] of Object.entries(mobileOnly[theme])) {
      const cssVar = toCssVar(token);
      const mobile = value.toLowerCase();
      if (token in shared[theme]) report.issues.push({ theme, token, cssVar, mobile, kind: 'overlap' });
      const found = lookup(web, theme, cssVar);
      if (found === null) continue;
      if ('unsupported' in found) report.issues.push({ theme, token, cssVar, mobile, kind: 'conflict', web: found.unsupported });
      else if (found.hex !== normalizeHex(mobile)) report.issues.push({ theme, token, cssVar, mobile, kind: 'conflict', web: found.hex });
      else report.nowInWeb.push({ theme, token, cssVar });
    }
  }
  return report;
}

/** Web colour variables that mobile does not carry (informational, not a failure). */
export function webOnlyVars(mobileTokens: Record<string, string>, web: WebTokens): string[] {
  const known = new Set(Object.keys(mobileTokens).map(toCssVar));
  return Object.keys(web.light).filter((v) => !known.has(v));
}
