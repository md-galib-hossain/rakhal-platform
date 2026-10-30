import {
  CustomField,
  normalizeAppliesTo,
  toDefinition,
  validateCustomPayload,
  validateFields,
} from './custom-type';

const fields: CustomField[] = [
  {
    key: 'product',
    label: 'Product',
    kind: 'select',
    options: ['A', 'B'],
    required: true,
  },
  { key: 'minutes', label: 'Minutes', kind: 'number' },
  { key: 'note', label: 'Note', kind: 'text' },
];

describe('custom event types (RAKHAL-486)', () => {
  it('accepts good fields and rejects bad ones', () => {
    expect(validateFields(fields)).toEqual([]);
    expect(validateFields('x')).toHaveLength(1);
    expect(
      validateFields([{ key: 'Bad Key', label: 'x', kind: 'text' }])[0],
    ).toMatch(/key/);
    expect(
      validateFields([
        { key: 'a', label: 'A', kind: 'text' },
        { key: 'a', label: 'B', kind: 'text' },
      ]).join(),
    ).toMatch(/repeated/);
    expect(
      validateFields([{ key: 'a', label: 'A', kind: 'select' }]).join(),
    ).toMatch(/options/);
    expect(
      validateFields(
        Array.from({ length: 21 }, (_, i) => ({
          key: `k${i}`,
          label: 'x',
          kind: 'text',
        })),
      ),
    ).toHaveLength(1);
  });

  it('validates a payload against the fields', () => {
    expect(validateCustomPayload(fields, { product: 'A', minutes: 5 })).toEqual(
      [],
    );
    expect(validateCustomPayload(fields, {}).join()).toMatch(
      /product is required/,
    );
    expect(validateCustomPayload(fields, { product: 'C' }).join()).toMatch(
      /one of/,
    );
    expect(
      validateCustomPayload(fields, { product: 'A', minutes: '5' }).join(),
    ).toMatch(/number/);
    expect(
      validateCustomPayload(fields, { product: 'A', extra: 1 }).join(),
    ).toMatch(/not a field/);
  });

  it('caps the payload at 4 KB', () => {
    const big: CustomField[] = [{ key: 'note', label: 'Note', kind: 'text' }];
    expect(
      validateCustomPayload(big, { note: 'x'.repeat(5000) }).join(),
    ).toMatch(/4 KB/);
  });

  it('appliesTo defaults every chip to LISTED and rejects junk', () => {
    const a = normalizeAppliesTo({ MALE: 'BLOCK' })!;
    expect(a.MALE).toBe('BLOCK');
    expect(a.COW).toBe('LISTED');
    expect(normalizeAppliesTo({ MALE: 'NOPE' })).toBeNull();
  });

  it('builds a catalogue-shaped definition', () => {
    const d = toDefinition({
      id: 'x',
      name: 'Hoof bath',
      group: 'HEALTH',
      appliesTo: { MALE: 'BLOCK' },
      fields,
      followUpDays: null,
    });
    expect(d.type).toBe('CUSTOM');
    expect(d.appliesTo.MALE).toBe('BLOCK');
    expect(d.permission).toBe('cattle.update');
  });
});
