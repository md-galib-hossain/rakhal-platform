import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { resolveFontDir, resolveFontPaths } from './pdf-fonts';

// fontkit is pdfkit's own dependency (pnpm keeps it nested), so resolve it relative to pdfkit.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fontkit = require(
  require.resolve('fontkit', { paths: [dirname(require.resolve('pdfkit'))] }),
) as {
  openSync(p: string): {
    hasGlyphForCodePoint(cp: number): boolean;
    layout(s: string): { glyphs: { id: number }[] };
    postscriptName: string;
  };
};

describe('bundled report font', () => {
  const { regular, bold } = resolveFontPaths();
  const font = fontkit.openSync(regular);

  it('is found with its OFL licence next to it', () => {
    expect(existsSync(join(resolveFontDir(), 'OFL.txt'))).toBe(true);
    expect(readFileSync(join(resolveFontDir(), 'OFL.txt'), 'utf8')).toMatch(
      /SIL OPEN FONT LICENSE/i,
    );
    expect(fontkit.openSync(bold).postscriptName).toContain('NotoSansBengali');
  });

  it('has a glyph for every codepoint of the strings the report prints (Latin, Bangla, taka)', () => {
    const sample =
      'Weekly farm report 0123456789 %+.,:;()/#·•…–—− শাপলা ডেইরি ফার্ম, গাজীপুর গাভী ক্ষীর শ্রীমতী ৳ ১২৩৪৫৬৭৮৯০';
    for (const ch of sample) {
      expect({
        ch,
        ok: font.hasGlyphForCodePoint(ch.codePointAt(0) as number),
      }).toEqual({ ch, ok: true });
    }
  });

  it('shapes Bengali conjuncts (fewer glyphs than codepoints, so it is not a naive mapping)', () => {
    // ক্ষ (ka + virama + ssa) and শ্রী (sha + virama + ra + ii) form conjunct/reordered glyphs.
    const text = 'গাভী ক্ষীর শ্রী';
    const codepoints = [...text].length;
    const glyphs = font.layout(text).glyphs;
    expect(glyphs.length).toBeLessThan(codepoints);
    // Naive 1:1 mapping would give ids of the plain letters; the conjunct glyph id must be new.
    const naive = [...text].map((c) => font.layout(c).glyphs[0]?.id);
    expect(glyphs.map((g) => g.id)).not.toEqual(naive);
  });
});
