import {
  buildCatalogue,
  expandGrants,
  toMatrix,
  invalidKeys,
} from './permission-matrix';

describe('permission-matrix', () => {
  it('groups the catalogue by resource without wildcards', () => {
    const catalogue = buildCatalogue();
    const cattle = catalogue.find((c) => c.resource === 'cattle');

    expect(cattle).toBeDefined();
    expect(cattle?.actions).toEqual(
      expect.arrayContaining(['read', 'create', 'update', 'delete', 'bcs']),
    );
    // wildcards must never leak into the editable matrix
    expect(cattle?.actions).not.toContain('*');
  });

  it('expands the global wildcard to every concrete key', () => {
    const effective = expandGrants(['*']);
    expect(effective.has('cattle.read')).toBe(true);
    expect(effective.has('finance.void')).toBe(true);
    // wildcards themselves are not concrete keys
    expect(effective.has('*')).toBe(false);
    expect(effective.has('cattle.*')).toBe(false);
  });

  it('expands a resource wildcard to only that resource', () => {
    const effective = expandGrants(['cattle.*']);
    expect(effective.has('cattle.bcs')).toBe(true);
    expect(effective.has('cattle.archive')).toBe(true);
    expect(effective.has('finance.read')).toBe(false);
  });

  it('keeps exact grants exact', () => {
    const effective = expandGrants(['milk.read', 'milk.log']);
    expect(effective.has('milk.read')).toBe(true);
    expect(effective.has('milk.log')).toBe(true);
    expect(effective.has('milk.delete')).toBe(false);
  });

  it('renders a boolean matrix from stored grants', () => {
    const matrix = toMatrix(['cattle.read', 'finance.*']);
    expect(matrix.cattle.read).toBe(true);
    expect(matrix.cattle.create).toBe(false);
    expect(matrix.finance.void).toBe(true);
  });

  it('flags unknown keys', () => {
    expect(invalidKeys(['cattle.read', 'bogus.key'])).toEqual(['bogus.key']);
    expect(invalidKeys(['cattle.*', '*'])).toEqual([]);
  });
});
