import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Bundled Noto Sans Bengali (SIL OFL 1.1, see assets/fonts/OFL.txt): Bengali + Latin + the taka sign. */
export const FONT_REGULAR_FILE = 'NotoSansBengali-Regular.ttf';
export const FONT_BOLD_FILE = 'NotoSansBengali-Bold.ttf';
export const FONT_POSTSCRIPT_NAME = 'NotoSansBengali';

/**
 * Candidate `assets/fonts` directories, in order:
 * 1. `<dist>/assets/fonts`  (copied by nest-cli `assets`; the production layout)
 * 2. `<repo>/assets/fonts`  (jest / ts-node running from `src`, or dist next to the repo root)
 * Both are 4 / 5 levels above this directory because `src` and `dist` share the same depth.
 */
export function fontDirCandidates(from: string = __dirname): string[] {
  return [
    join(from, '..', '..', '..', '..', 'assets', 'fonts'),
    join(from, '..', '..', '..', '..', '..', 'assets', 'fonts'),
    join(process.cwd(), 'assets', 'fonts'),
  ];
}

export function resolveFontDir(from: string = __dirname): string {
  for (const dir of fontDirCandidates(from)) {
    if (
      existsSync(join(dir, FONT_REGULAR_FILE)) &&
      existsSync(join(dir, FONT_BOLD_FILE))
    ) {
      return dir;
    }
  }
  throw new Error('Report font files were not found.');
}

export function resolveFontPaths(from: string = __dirname): {
  regular: string;
  bold: string;
} {
  const dir = resolveFontDir(from);
  return {
    regular: join(dir, FONT_REGULAR_FILE),
    bold: join(dir, FONT_BOLD_FILE),
  };
}
