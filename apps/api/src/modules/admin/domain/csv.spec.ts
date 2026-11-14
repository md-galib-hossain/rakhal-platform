import { csvCell, toCsv } from './csv';

describe('csvCell', () => {
  it('leaves plain values alone and blanks null/undefined', () => {
    expect(csvCell('hello')).toBe('hello');
    expect(csvCell(42)).toBe('42');
    expect(csvCell(true)).toBe('true');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('quotes commas, quotes and newlines (RFC 4180)', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('serialises dates as ISO strings', () => {
    expect(csvCell(new Date('2026-10-23T00:00:00.000Z'))).toBe(
      '2026-10-23T00:00:00.000Z',
    );
  });

  it.each([
    '=SUM(A1:A9)',
    '+1+1',
    '-2+3',
    '@cmd',
    '=HYPERLINK("http://evil","x")',
  ])('neutralises formula injection in %s', (value) => {
    const cell = csvCell(value);
    // The visible text is prefixed with a quote so spreadsheets treat it as text.
    expect(cell.replace(/^"/, '').startsWith("'")).toBe(true);
  });

  it('neutralises a leading tab or carriage return', () => {
    expect(csvCell('\t=1+1').replace(/^"/, '').startsWith("'")).toBe(true);
    expect(csvCell('\r=1+1').replace(/^"/, '').startsWith("'")).toBe(true);
  });

  it('does not touch a dash or equals sign that is not at the start', () => {
    expect(csvCell('a-b=c')).toBe('a-b=c');
  });
});

describe('toCsv', () => {
  it('writes a header, CRLF rows and a trailing newline', () => {
    expect(
      toCsv(
        ['id', 'name'],
        [
          [1, 'A'],
          [2, 'B,C'],
        ],
      ),
    ).toBe('id,name\r\n1,A\r\n2,"B,C"\r\n');
  });

  it('writes just the header for no rows', () => {
    expect(toCsv(['id'], [])).toBe('id\r\n');
  });

  it('protects header cells and values alike', () => {
    expect(toCsv(['=x'], [['@y']])).toBe("'=x\r\n'@y\r\n");
  });
});
