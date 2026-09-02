/* eslint-disable no-console */
import { loadTarget, printTarget, run, SEED_ARGS } from './lib/db-target';

/**
 * Non-destructive deploy path: applies pending migrations, then (optionally)
 * runs the idempotent seed to refresh catalogues (permissions, roles, units,
 * income categories, plans, legal docs).
 *
 *   pnpm db:deploy:staging              # migrate + seed
 *   pnpm db:deploy:staging --no-seed    # migrate only
 *
 * Use this for a normal staging release; `pnpm db:reset` only when the staging
 * data should be thrown away.
 */
const argv = process.argv.slice(2);
const target = loadTarget(argv);
printTarget(target);

run('pnpm', [
  'exec',
  'prisma',
  'migrate',
  'deploy',
  '--config',
  'prisma.config.ts',
]);

if (argv.includes('--no-seed')) {
  console.log('\nMigrations applied (seed skipped).');
} else {
  run('pnpm', SEED_ARGS);
  console.log('\nMigrate + seed complete.');
}
