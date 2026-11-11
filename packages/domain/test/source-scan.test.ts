/**
 * Source guard for the hard rules of @rakhal/domain (spec 2.3). The scan walks the TypeScript AST of every file under
 * src/ (recursively), so comments and string contents can never hide or fake a violation (no regex stripping).
 *
 * Rules: no Intl, no toLocale*, no toFixed, no local-time Date getters/setters/formatters/constructors, no process / DOM
 * globals, no hex colour literals, no default exports, no enum/namespace/module blocks, and the only import specifiers
 * allowed (static, side-effect, re-export, dynamic import(), require(), import-equals, import types) are "./*.ts".
 *
 * `scanSource` is exercised against planted violations below, so a scanner regression cannot silently pass.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";

const pkgDir = resolve(import.meta.dirname, "..");
const srcDir = join(pkgDir, "src");

/** Date methods that read or write local time (getUTC*, setUTC*, getTime, setTime are timezone independent and allowed). */
const LOCAL_DATE_NAMES = [
  "getDate", "getDay", "getFullYear", "getHours", "getMilliseconds", "getMinutes", "getMonth", "getSeconds", "getYear",
  "getTimezoneOffset",
  "setDate", "setFullYear", "setHours", "setMilliseconds", "setMinutes", "setMonth", "setSeconds", "setYear",
  "toString", "toDateString", "toTimeString",
];
const FORBIDDEN_NAMES = new Set([...LOCAL_DATE_NAMES, "toFixed", "Intl"]);
const FORBIDDEN_GLOBALS = new Set([
  "process", "window", "document", "navigator", "global", "globalThis", "self", "localStorage", "sessionStorage", "require",
]);
// "./x.ts" or "./sub/x.ts"; never "..", never a bare/package specifier, never a missing or wrong extension.
const ALLOWED_SPECIFIER = /^\.\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\.ts$/;
const HEX_COLOUR = /^#[0-9a-fA-F]{3,8}$/;

const isForbiddenMember = (name: string) => FORBIDDEN_NAMES.has(name) || name.startsWith("toLocale");

export function scanSource(code: string, fileName = "snippet.ts"): string[] {
  const out: string[] = [];
  const syntax = ts.transpileModule(code, {
    fileName,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).diagnostics;
  for (const d of syntax ?? []) out.push(`${fileName}: syntax error: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`);

  const sf = ts.createSourceFile(fileName, code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const flag = (n: ts.Node, msg: string) => {
    out.push(`${fileName}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1} ${msg}`);
  };

  const checkSpecifier = (n: ts.Node, spec: ts.Expression | undefined) => {
    if (spec === undefined || !ts.isStringLiteralLike(spec)) return flag(n, "non-literal module specifier");
    if (!ALLOWED_SPECIFIER.test(spec.text)) flag(n, `import specifier "${spec.text}" is not "./*.ts"`);
  };

  const visit = (n: ts.Node): void => {
    if (ts.isIdentifier(n) || ts.isPrivateIdentifier(n)) {
      if (isForbiddenMember(n.text)) flag(n, `forbidden identifier ${n.text}`);
      if (FORBIDDEN_GLOBALS.has(n.text)) flag(n, `forbidden global ${n.text}`);
    } else if (ts.isStringLiteralLike(n)) {
      // Covers bracket access d["getDate"] / d[`getDate`] and Reflect.get(d, "getDate") (names only, so prose like
      // "no Intl here" in a message is fine unless it is exactly a forbidden member name).
      if (isForbiddenMember(n.text)) flag(n, `forbidden name as string "${n.text}"`);
      if (HEX_COLOUR.test(n.text)) flag(n, `hex colour literal "${n.text}"`);
    }

    if (ts.isImportDeclaration(n)) checkSpecifier(n, n.moduleSpecifier);
    else if (ts.isExportDeclaration(n) && n.moduleSpecifier !== undefined) checkSpecifier(n, n.moduleSpecifier);
    else if (ts.isImportEqualsDeclaration(n)) flag(n, "import-equals / require is not allowed");
    else if (ts.isImportTypeNode(n)) flag(n, "import() type is not allowed");
    else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword) flag(n, "dynamic import() is not allowed");
    else if (ts.isExportAssignment(n)) flag(n, "export default / export = is not allowed");
    else if (ts.isExportSpecifier(n) && (n.name.text === "default" || n.propertyName?.text === "default")) flag(n, "default export");
    else if (ts.isEnumDeclaration(n)) flag(n, "enum is not allowed");
    else if (ts.isModuleDeclaration(n)) flag(n, "namespace / module block is not allowed");

    if (ts.canHaveModifiers(n) && ts.getModifiers(n)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) {
      flag(n, "default export");
    }

    if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "Date") {
      const args = n.arguments ?? [];
      if (args.length >= 2) flag(n, "new Date(y, m, ...) is a local-time constructor");
      const first = args[0];
      if (args.length === 1 && first !== undefined && ts.isStringLiteralLike(first)) flag(n, "new Date(string) parse is not allowed");
    }
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "Date") flag(n, "Date() call returns local time text");
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "Date" && n.name.text === "parse") {
      flag(n, "Date.parse is not allowed");
    }

    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}

const allFiles = listFiles(srcDir);

test("src contains only .ts files (no .js/.tsx/.d.ts surprises) and at least the known modules", () => {
  assert.ok(allFiles.length >= 6, `found ${allFiles.length} files`);
  for (const f of allFiles) assert.ok(f.endsWith(".ts") && !f.endsWith(".d.ts"), `unexpected file ${relative(pkgDir, f)}`);
});

test("src passes every source rule (AST scan, recursive)", () => {
  const problems: string[] = [];
  for (const f of allFiles) problems.push(...scanSource(readFileSync(f, "utf8"), relative(pkgDir, f)));
  assert.deepEqual(problems, []);
});

test("package.json has zero runtime dependencies", () => {
  const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.peerDependencies, undefined);
  assert.equal(pkg.optionalDependencies, undefined);
});

// ---- scanner self-tests: every planted violation must be flagged -------------------------------------------------

const PLANTED: [string, string][] = [
  ["Intl", `const f = new Intl.NumberFormat("en");`],
  ["Intl via string containing //", `const a = "//"; const f = new Intl.NumberFormat("en");`],
  ["Intl between /* and */ strings", `const a = "/*"; const f = new Intl.NumberFormat("en"); const b = "*/";`],
  ["toFixed after string containing //", `const a = "x // y"; const s = (1.5).toFixed(2);`],
  ["getDate between template /* and */", "const a = `/*${1}`; d.getDate(); const b = `*/`;"],
  ["Date.prototype.getDate.call", `const n = Date.prototype.getDate.call(d);`],
  ["bracket access getDate", `const n = d["getDate"]();`],
  ["template bracket access", "const n = d[`getHours`]();"],
  ["destructured getMonth", `const { getMonth } = d;`],
  ["toLocaleDateString", `d.toLocaleDateString("bn");`],
  ["toLocaleString", `n.toLocaleString();`],
  ["toLocaleUpperCase", `s.toLocaleUpperCase();`],
  ["toString on Date", `d.toString();`],
  ["toDateString", `d.toDateString();`],
  ["toTimeString", `d.toTimeString();`],
  ["getFullYear", `d.getFullYear();`],
  ["getDay", `d.getDay();`],
  ["getMinutes", `d.getMinutes();`],
  ["getSeconds", `d.getSeconds();`],
  ["getMilliseconds", `d.getMilliseconds();`],
  ["getYear", `d.getYear();`],
  ["getTimezoneOffset", `d.getTimezoneOffset();`],
  ["setHours", `d.setHours(0);`],
  ["setDate", `d.setDate(1);`],
  ["setMonth", `d.setMonth(1);`],
  ["setFullYear", `d.setFullYear(2020);`],
  ["setMinutes", `d.setMinutes(1);`],
  ["setSeconds", `d.setSeconds(1);`],
  ["setMilliseconds", `d.setMilliseconds(1);`],
  ["new Date(y, m, d) local constructor", `const d = new Date(2026, 0, 1);`],
  ["new Date(y, m)", `const d = new Date(2026, 0);`],
  ["new Date(string)", `const d = new Date("2026-01-01T00:00");`],
  ["Date() call", `const s = Date();`],
  ["Date.parse", `const t = Date.parse("2026-01-01");`],
  ["process", `const e = process.env.X;`],
  ["window", `const w = window.innerWidth;`],
  ["document", `const w = document.title;`],
  ["navigator", `const w = navigator.language;`],
  ["globalThis", `const g = globalThis["Int" + "l"];`],
  ["hex colour 3", `const c = "#fff";`],
  ["hex colour 8 (template)", "const c = `#ABCDEF12`;"],
  ["default export expression", `export default 1;`],
  ["default export function", `export default function f() {}`],
  ["default export specifier", `const a = 1; export { a as default };`],
  ["export =", `const a = 1; export = a;`],
  ["enum", `export enum E { A }`],
  ["const enum", `export const enum E { A }`],
  ["namespace", `export namespace N { export const a = 1; }`],
  ["declare module", `declare module "x" { export const a: number; }`],
  ["static import of a package", `import fs from "node:fs";`],
  ["static import of react", `import { useState } from "react";`],
  ["type import of a package", `import type { T } from "react";`],
  ["side-effect import", `import "some-polyfill";`],
  ["side-effect relative import without ext", `import "./x";`],
  ["dynamic import()", `const m = await import("./x.ts");`],
  ["dynamic import of a package", `const m = import("lodash");`],
  ["require()", `const x = require("./x.ts");`],
  ["import-equals require", `import x = require("./x.ts");`],
  ["import() type", `type T = import("./x.ts").T;`],
  ["parent relative import", `import { a } from "../x.ts";`],
  ["relative import without extension", `import { a } from "./x";`],
  ["relative import with .js", `import { a } from "./x.js";`],
  ["re-export from package", `export { a } from "pkg";`],
  ["export * from parent", `export * from "../x.ts";`],
  ["export * as from bare", `export * as ns from "pkg";`],
  ["syntax error is reported, not skipped", `const = ;`],
];

for (const [name, code] of PLANTED) {
  test(`scanner flags planted violation: ${name}`, () => {
    assert.notEqual(scanSource(code).length, 0, `not flagged: ${code}`);
  });
}

const CLEAN: [string, string][] = [
  ["comments and prose strings that only mention forbidden words", `// Intl, toFixed, getDate, process\n/* new Date(2026, 0, 1) */\nconst m = "no Intl or toFixed here";`],
  ["UTC getters and numeric Date constructor", `const d = new Date(ms); const a = d.getUTCDate() + d.getUTCDay() + d.getTime(); d.setTime(1);`],
  ["relative .ts imports", `import { a } from "./a.ts";\nimport type { B } from "./sub/b.ts";\nexport * from "./c.ts";\nexport { x } from "./d.ts";`],
  ["hex numbers and plain # text", `const z = 0x09e6; const s = "#"; const t = "#xyz"; const u = "#12";`],
  ["named exports", `export const a = 1; export function f() {}; export type T = string;`],
];

for (const [name, code] of CLEAN) {
  test(`scanner accepts clean code: ${name}`, () => {
    assert.deepEqual(scanSource(code), []);
  });
}
