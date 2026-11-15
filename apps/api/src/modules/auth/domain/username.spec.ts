import {
  isEmailIdentifier,
  normalizeUsername,
  usernameProblem,
} from './username';

describe('username rules (WP5b)', () => {
  it('normalises by trimming and lowercasing', () => {
    expect(normalizeUsername('  Rahim.Uddin ')).toBe('rahim.uddin');
  });

  it.each([
    'abc',
    'rahim',
    'rahim.uddin',
    'farm_worker-01',
    'a1b',
    'x'.repeat(32),
  ])('accepts %s', (name) => {
    expect(usernameProblem(name)).toBeNull();
  });

  it.each([
    ['ab', 'length'],
    ['x'.repeat(33), 'length'],
    ['', 'length'],
    ['has space', 'format'],
    ['a@b.com', 'format'],
    ['.leading', 'format'],
    ['trailing-', 'format'],
    ['UPPER', 'format'],
    ['বাংলা', 'format'],
    ['admin', 'reserved'],
    ['rakhal', 'reserved'],
  ])('rejects %s as %s', (name, reason) => {
    expect(usernameProblem(name)).toBe(reason);
  });

  it('an identifier is an email exactly when it contains @', () => {
    expect(isEmailIdentifier('a@b.com')).toBe(true);
    expect(isEmailIdentifier('rahim.uddin')).toBe(false);
  });
});
