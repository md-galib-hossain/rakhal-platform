// Runs the e2e suite in batches, one jest process per batch.
//
// Why: `jest --runInBand` over the whole suite (~220 specs) runs out of memory in a single process, even with an
// 8 GB heap (verified 2026-11-14, same in the pre-monorepo repo). A fresh process per batch frees the heap.
//
// Usage: node scripts/e2e-batches.mjs [--size 25] [-- <extra jest args>]
// Exit code is non-zero if any batch fails; every batch always runs so one failure does not hide the rest.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const sizeIdx = argv.indexOf('--size');
const size = sizeIdx >= 0 ? Number(argv[sizeIdx + 1]) : 25;
const dashIdx = argv.indexOf('--');
const extra = dashIdx >= 0 ? argv.slice(dashIdx + 1) : [];

if (!Number.isInteger(size) || size < 1) {
  console.error('--size must be a positive integer');
  process.exit(2);
}

const specs = readdirSync(join(root, 'test'))
  .filter((f) => f.endsWith('.e2e-spec.ts'))
  .map((f) => f.replace(/\.e2e-spec\.ts$/, ''))
  .sort();

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const batches = [];
for (let i = 0; i < specs.length; i += size) batches.push(specs.slice(i, i + size));

console.log(`e2e: ${specs.length} specs in ${batches.length} batches of up to ${size}`);

let failed = 0;
batches.forEach((batch, i) => {
  const pattern = `(${batch.map((s) => `${escape(s)}\\.e2e-spec`).join('|')})`;
  console.log(`\n--- batch ${i + 1}/${batches.length} (${batch.length} specs) ---`);
  const res = spawnSync(
    process.execPath,
    [
      join(root, 'node_modules', 'jest', 'bin', 'jest.js'),
      '--config',
      './test/jest-e2e.json',
      '--runInBand',
      '--forceExit',
      '--testPathPatterns',
      pattern,
      ...extra,
    ],
    { cwd: root, stdio: 'inherit' },
  );
  if (res.status !== 0) {
    failed++;
    console.error(`batch ${i + 1} failed (exit ${res.status})`);
  }
});

console.log(`\ne2e: ${batches.length - failed}/${batches.length} batches passed`);
process.exit(failed === 0 ? 0 : 1);
