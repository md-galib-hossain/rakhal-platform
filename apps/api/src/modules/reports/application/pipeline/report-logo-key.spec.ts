import { logoObjectKey } from './report-compute.service';

const F = 'cfarm1';

describe('logoObjectKey', () => {
  it('keeps keys under the farm own prefix', () => {
    expect(logoObjectKey('farms/cfarm1/logo/x/full.jpg', F)).toBe(
      'farms/cfarm1/logo/x/full.jpg',
    );
    expect(logoObjectKey('  farms/cfarm1/a.png ', F)).toBe(
      'farms/cfarm1/a.png',
    );
  });

  it('rejects another tenant prefix, bare prefixes and non-farm keys', () => {
    expect(logoObjectKey('farms/cother/logo.png', F)).toBeNull();
    expect(logoObjectKey('farms/cfarm10/logo.png', F)).toBeNull();
    expect(logoObjectKey('farms/cfarm1/', F)).toBeNull();
    expect(logoObjectKey('media/cfarm1/full.jpg', F)).toBeNull();
  });

  it('rejects URLs, traversal and unsafe strings', () => {
    expect(logoObjectKey(null, F)).toBeNull();
    expect(logoObjectKey(undefined, F)).toBeNull();
    expect(logoObjectKey('', F)).toBeNull();
    expect(
      logoObjectKey('https://cdn.example.com/farms/cfarm1/a.png', F),
    ).toBeNull();
    expect(logoObjectKey('//host/logo.png', F)).toBeNull();
    expect(logoObjectKey('farms/cfarm1/../cother/a.png', F)).toBeNull();
    expect(logoObjectKey('/farms/cfarm1/a.png', F)).toBeNull();
    expect(logoObjectKey('farms/cfarm1/a b.png', F)).toBeNull();
    expect(logoObjectKey('farms/cfarm1/' + 'x'.repeat(300), F)).toBeNull();
  });
});
