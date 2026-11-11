/** Helpers for the vendored web globals.css snapshot (vendor/). Read-only toward the web repo. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative, resolve, sep } from 'node:path';

export const mobileRoot = resolve(import.meta.dirname, '..', '..');
export const SNAPSHOT_CSS = join(mobileRoot, 'vendor', 'web-globals.css');
export const SNAPSHOT_MD = join(mobileRoot, 'vendor', 'SNAPSHOT.md');

/** Web repo location relative to this repo (sibling checkout layout: <projects>/rakhal-platform, <projects>/Rakhal). */
const LIVE_RELATIVE = ['..', '..', '..', 'Rakhal', 'Repos', 'rakhal-consumer-frontend', 'app', 'globals.css'];

/** Live web file: RAKHAL_WEB_GLOBALS_CSS if set, else the sibling-checkout location. */
export function liveGlobalsPath(env: Record<string, string | undefined> = process.env): string {
  return env.RAKHAL_WEB_GLOBALS_CSS || resolve(mobileRoot, ...LIVE_RELATIVE);
}

/** Path recorded in SNAPSHOT.md: relative to apps/mobile with forward slashes, never an absolute machine path. */
export function relativeSource(source: string): string {
  return relative(mobileRoot, resolve(source)).split(sep).join('/');
}

/** sha256 over the text with CRLF normalised to LF, so Windows/Linux checkouts hash the same. */
export function sha256Text(text: string): string {
  return createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
}

export interface SnapshotMeta {
  source: string;
  commit: string;
  dirty: string;
  sha256: string;
  capturedAt: string;
}

export function renderSnapshotMd(m: SnapshotMeta): string {
  return `# Web globals.css snapshot

Pinned, read-only copy of the web colour tokens, so CI can check drift without the web repo.
Do not edit \`web-globals.css\` by hand. Refresh with \`node scripts/refresh-web-snapshot.ts\` (then review the diff).

- source: ${m.source}
- commit: ${m.commit}
- source-file-dirty: ${m.dirty}
- sha256: ${m.sha256}
- captured: ${m.capturedAt}

The source path is relative to apps/mobile.

sha256 is computed over the file text with CRLF normalised to LF.
\`commit\` is the web repo HEAD at capture time; if source-file-dirty is "yes" the copied file had uncommitted edits, so the commit alone does not reproduce it.
`;
}

export function parseSnapshotMd(md: string): SnapshotMeta {
  const get = (k: string): string => new RegExp(`^- ${k}: (.*)$`, 'm').exec(md)?.[1]?.trim() ?? '';
  return { source: get('source'), commit: get('commit'), dirty: get('source-file-dirty'), sha256: get('sha256'), capturedAt: get('captured') };
}

export function readSnapshotMeta(): SnapshotMeta {
  return parseSnapshotMd(readFileSync(SNAPSHOT_MD, 'utf8'));
}

/** Read-only git queries about the web file. Returns "unknown" when git or the repo is unavailable. */
export function gitInfo(file: string): { commit: string; dirty: string } {
  const dir = dirname(file);
  const git = (args: string[]): string => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try {
    return { commit: git(['rev-parse', 'HEAD']), dirty: git(['status', '--porcelain', '--', file]) ? 'yes' : 'no' };
  } catch {
    return { commit: 'unknown', dirty: 'unknown' };
  }
}
