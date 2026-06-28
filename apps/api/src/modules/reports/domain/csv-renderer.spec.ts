import { renderCsv } from './csv-renderer';

describe('renderCsv', () => {
  it('renders title, columns and rows', () => {
    const csv = renderCsv({
      title: 'Daily Milk',
      columns: ['TAG', 'Litres'],
      rows: [
        ['GVD-001', 22.5],
        ['GVD-002', 18],
      ],
    }).toString('utf-8');
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Daily Milk');
    expect(lines).toContain('TAG,Litres');
    expect(lines).toContain('GVD-001,22.5');
  });

  it('quotes fields containing commas, quotes or newlines', () => {
    const csv = renderCsv({
      title: 'T',
      columns: ['Name'],
      rows: [['Ahmed, Sons'], ['He said "hi"']],
    }).toString('utf-8');
    expect(csv).toContain('"Ahmed, Sons"');
    expect(csv).toContain('"He said ""hi"""');
  });

  it('emits period and summary lines before the table', () => {
    const csv = renderCsv({
      title: 'P&L',
      period: '2026-06',
      summary: [{ label: 'Net', value: 8800 }],
      columns: ['Metric', 'Value'],
      rows: [['Net', 8800]],
    }).toString('utf-8');
    expect(csv).toContain('Period: 2026-06');
    expect(csv).toContain('Net,8800');
  });

  it('renders empty values for null cells', () => {
    const csv = renderCsv({
      title: 'T',
      columns: ['A', 'B'],
      rows: [['x', null]],
    }).toString('utf-8');
    expect(csv.split('\r\n')).toContain('x,');
  });
});
