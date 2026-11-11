/**
 * Copies the live web globals.css into vendor/web-globals.css and rewrites vendor/SNAPSHOT.md
 * (source path relative to apps/mobile, web repo commit, sha256). Web file is only read; web git is only queried.
 * Source: RAKHAL_WEB_GLOBALS_CSS, else the sibling checkout (see scripts/lib/snapshot.ts).
 * Usage: node scripts/refresh-web-snapshot.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { SNAPSHOT_CSS, SNAPSHOT_MD, gitInfo, liveGlobalsPath, relativeSource, renderSnapshotMd, sha256Text } from './lib/snapshot.ts';

const source = liveGlobalsPath();
if (!existsSync(source)) {
  console.error(`refresh-web-snapshot: web globals.css not found at ${source}`);
  console.error('Set RAKHAL_WEB_GLOBALS_CSS to its location.');
  process.exit(2);
}

const text = readFileSync(source, 'utf8');
const { commit, dirty } = gitInfo(source);
mkdirSync(dirname(SNAPSHOT_CSS), { recursive: true });
writeFileSync(SNAPSHOT_CSS, text);
writeFileSync(
  SNAPSHOT_MD,
  renderSnapshotMd({ source: relativeSource(source), commit, dirty, sha256: sha256Text(text), capturedAt: new Date().toISOString().slice(0, 10) }),
);
console.log(`Snapshot written: ${SNAPSHOT_CSS}`);
console.log(`  source ${source}\n  commit ${commit} (file dirty: ${dirty})\n  sha256 ${sha256Text(text)}`);
