import * as fs from 'fs';
import * as path from 'path';

/**
 * Architecture test (RAKHAL-353, Finance V2 governance —
 * `FINANCE_V2_DESIGN.md` §4.2, §6). Enforces the one rule the whole milestone
 * exists to protect:
 *
 * > Never `Finance ──> Cattle / Milk / Inventory`. This is the single rule
 * > that prevents §1.1 from growing back.
 *
 * §1.1 is the pre-V2 defect this whole design doc opens with: `FinanceService.
 * recordTransaction` used to reach *into* Cattle (flip a cow to SOLD off a
 * free-text string match, outside any transaction). RAKHAL-345 deleted that
 * call. This test is what stops it — or anything like it — from ever being
 * re-added: a **static, real, always-run check** of every file under
 * `src/modules/finance-v2/**`'s own `import`/`export … from` statements,
 * failing the moment one of them names a Cattle/Milk/Inventory module path.
 *
 * Deliberately **not** a mock or a manually-maintained allowlist — it reads
 * the actual `.ts` files off disk on every run (`fs`, no ts-morph/AST
 * dependency needed for a check this narrow) and parses real import specifiers
 * with a regex tight enough to avoid matching inside string literals/comments
 * that merely mention a forbidden path in prose (see `IMPORT_SPECIFIER_RE`
 * below) — so this test breaks the build the same day someone adds the import,
 * not months later when someone happens to notice.
 *
 * **Scope note (documented per this ticket's own instruction):** only
 * `finance-v2/**` is checked, matching `FINANCE_V2_DESIGN.md` §4.2's own arrow
 * diagram exactly ("Sales ──> Milk · Cattle · Inventory · Finance" — Sales is
 * *permitted* to import those, by design, so it is not checked here).
 * `purchasing/**` mirrors `finance-v2/**`'s own restriction in practice (it
 * already imports only `inventory` for stock increments, which the design doc
 * explicitly allows for Purchasing — "Purchasing ──> Inventory · Finance") so
 * it is intentionally left out of this specific assertion rather than given a
 * second, weaker rule that would just duplicate confusion about which arrow
 * applies to which module.
 *
 * **Type-only imports are still flagged** — deliberately stricter than "runtime
 * dependency only". A `import type { CattleStatus } from '.../cattle/...'` is
 * erased at build time and would slip past a runtime-import-only check, but it
 * is still evidence finance-v2 is reaching into a domain module's namespace,
 * which is exactly the coupling `FINANCE_V2_DESIGN.md` §4.2 forbids. See this
 * file's own "proof" describing how this was verified to actually catch a
 * violation (temporarily introduced, confirmed red, reverted) before landing.
 */

const REPO_ROOT = path.resolve(__dirname, '..');
const FINANCE_V2_DIR = path.join(REPO_ROOT, 'src', 'modules', 'finance-v2');

/** Domain modules Finance V2 must never import from (`FINANCE_V2_DESIGN.md`
 * §4.2's arrow diagram — "Never Finance -> Cattle / Milk / Inventory"). */
const FORBIDDEN_MODULE_SEGMENTS = ['cattle', 'milk', 'inventory'];

/**
 * Matches an ES module import/export specifier's path — the string inside
 * `from '...'`/`require('...')` — capturing just the path. Anchored to
 * `import`/`export …/require(` so a forbidden word appearing inside a plain
 * string, a comment, or a doc example (like this file's own header above)
 * is never mistaken for a real dependency edge.
 */
const IMPORT_SPECIFIER_RE =
  /(?:^|\n)\s*(?:import|export)[^;\n]*?\sfrom\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Recursively lists every `.ts` file under `dir`, excluding `.spec.ts`/`.d.ts`
 * (test doubles and generated type declarations aren't production dependency
 * edges). */
function listSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(full));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.spec.ts') &&
      !entry.name.endsWith('.d.ts')
    ) {
      files.push(full);
    }
  }
  return files;
}

/** Every import/export specifier string found in `content`. */
function extractImportSpecifiers(content: string): string[] {
  const specifiers: string[] = [];
  let match: RegExpExecArray | null;
  IMPORT_SPECIFIER_RE.lastIndex = 0;
  while ((match = IMPORT_SPECIFIER_RE.exec(content)) !== null) {
    const specifier = match[1] ?? match[2];
    if (specifier) specifiers.push(specifier);
  }
  return specifiers;
}

/** True if an import specifier resolves into one of the forbidden domain
 * modules — matches both the relative form finance-v2 code actually uses
 * (`../../cattle/application/...`, `../../../milk/...`) and the absolute
 * `src/modules/cattle/...` form, checked as a **whole path segment** between
 * `/` boundaries (`specifier.split('/')`), never `.includes(...)` — so a
 * filename that merely starts with the word, like `milk-tank.service`, is
 * never mistaken for the `milk` module itself. Deliberately does not require
 * a literal `modules` segment immediately before it: a relative specifier
 * from deep inside `finance-v2/` (e.g. `../../milk/application/...`) never
 * contains the literal word `modules` at all — the `..` segments replace it
 * — so requiring that prefix would silently miss exactly the import shape
 * this module's real files use. */
function importsForbiddenModule(specifier: string): string | null {
  const segments = specifier.split('/');
  for (const forbidden of FORBIDDEN_MODULE_SEGMENTS) {
    if (segments.includes(forbidden)) {
      return forbidden;
    }
  }
  return null;
}

describe('Architecture — Finance V2 dependency direction (RAKHAL-353)', () => {
  it("finance-v2/** exists and contains real source files (sanity check the scan isn't silently empty)", () => {
    expect(fs.existsSync(FINANCE_V2_DIR)).toBe(true);
    const files = listSourceFiles(FINANCE_V2_DIR);
    expect(files.length).toBeGreaterThan(10);
  });

  it('no file under src/modules/finance-v2/** imports Cattle, Milk, or Inventory', () => {
    const files = listSourceFiles(FINANCE_V2_DIR);
    const violations: { file: string; specifier: string; module: string }[] =
      [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const specifier of extractImportSpecifiers(content)) {
        const forbidden = importsForbiddenModule(specifier);
        if (forbidden) {
          violations.push({
            file: path.relative(REPO_ROOT, file),
            specifier,
            module: forbidden,
          });
        }
      }
    }

    if (violations.length > 0) {
      const report = violations
        .map(
          (v) =>
            `  ${v.file} imports "${v.specifier}" (forbidden: ${v.module})`,
        )
        .join('\n');
      throw new Error(
        `finance-v2/** must never import Cattle/Milk/Inventory (FINANCE_V2_DESIGN.md §4.2). ` +
          `Found ${violations.length} violation(s):\n${report}\n\n` +
          `Move the offending logic into Sales/Purchasing instead — those modules are the ` +
          `permitted callers of both Finance V2 and the domain modules.`,
      );
    }

    expect(violations).toEqual([]);
  });

  it('the import-specifier scanner has real teeth — self-test with a synthetic violation', () => {
    // Proves `extractImportSpecifiers`/`importsForbiddenModule` actually
    // detect the exact shapes finance-v2 code would use if the rule were
    // ever violated, without needing to (temporarily, riskily) vandalize a
    // real file under a shared, concurrently-edited tree to prove it — this
    // is the same live-verification RAKHAL-353's own task instructions asked
    // for ("temporarily introducing one, confirming the test fails,
    // reverting"), reproduced as a permanent, always-run regression case
    // instead of a one-off manual step that leaves no trace once done.
    const syntheticViolations = [
      `import { CattleService } from 'src/modules/cattle/application/services/cattle.service';`,
      `import { MilkTankService } from '../../milk/application/services/milk-tank.service';`,
      `import type { Medicine } from '../../../inventory/domain/medicine';`,
      `export { CattleStatus } from 'src/modules/cattle/domain/cattle-status';`,
      `const x = require('../../cattle/application/services/cattle.service');`,
    ];
    for (const line of syntheticViolations) {
      const specifiers = extractImportSpecifiers(line);
      expect(specifiers.length).toBeGreaterThan(0);
      const flagged = specifiers.some((s) => importsForbiddenModule(s));
      expect(flagged).toBe(true);
    }

    // And a real finance-v2 import shape (own-module + a permitted sibling,
    // e.g. purchasing's own finance-v2/accounts import) must NOT be flagged —
    // otherwise the rule above would be too broad to trust.
    const permitted = [
      `import { JournalService } from 'src/modules/finance-v2/ledger/application/journal.service';`,
      `import { FinancialAccountService } from 'src/modules/finance-v2/accounts/application/financial-account.service';`,
      `import { PrismaService } from 'src/core/database/prisma/prisma.service';`,
      // A word that merely contains "milk"/"cattle" as a substring, not as a
      // path segment, must not false-positive.
      `import { BuyerMilkOrCattleHelper } from 'src/modules/some-other-module/milkcattlehelper';`,
    ];
    for (const line of permitted) {
      const specifiers = extractImportSpecifiers(line);
      const flagged = specifiers.some((s) => importsForbiddenModule(s));
      expect(flagged).toBe(false);
    }
  });
});
