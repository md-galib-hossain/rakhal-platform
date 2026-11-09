import {
  AudienceMember,
  MAX_RECIPIENTS,
  resolveAudience,
  validateManualAudience,
} from './audience';

const members: AudienceMember[] = [
  { userId: 'owner', roles: ['Owner'], active: true },
  { userId: 'mgr', roles: ['Manager'], active: true },
  { userId: 'mgr-off', roles: ['Manager'], active: false },
  { userId: 'w1', roles: ['Worker'], active: true },
  { userId: 'w2', roles: ['Worker'], active: true },
  { userId: 'gone', roles: ['Worker'], active: false },
];

describe('resolveAudience', () => {
  it('USER: the one user, only if still an active member', () => {
    expect(
      resolveAudience({ mode: 'USER', userIds: ['w1'], roles: [] }, members),
    ).toEqual(['w1']);
    expect(
      resolveAudience({ mode: 'USER', userIds: ['gone'], roles: [] }, members),
    ).toEqual([]);
    expect(
      resolveAudience(
        { mode: 'USER', userIds: ['stranger'], roles: [] },
        members,
      ),
    ).toEqual([]);
  });

  it('USERS: intersected with active members, de-duplicated, sorted', () => {
    expect(
      resolveAudience(
        {
          mode: 'USERS',
          userIds: ['w2', 'gone', 'owner', 'w2', 'x'],
          roles: [],
        },
        members,
      ),
    ).toEqual(['owner', 'w2']);
  });

  it('ROLES: every active member holding a role; deactivated members dropped', () => {
    expect(
      resolveAudience(
        { mode: 'ROLES', userIds: [], roles: ['Manager'] },
        members,
      ),
    ).toEqual(['mgr']);
    expect(
      resolveAudience(
        { mode: 'ROLES', userIds: [], roles: ['Owner', 'Worker'] },
        members,
      ),
    ).toEqual(['owner', 'w1', 'w2']);
    expect(
      resolveAudience({ mode: 'ROLES', userIds: [], roles: ['Vet'] }, members),
    ).toEqual([]);
  });

  it("SOURCE: the resolver's active users only, when it picked someone", () => {
    expect(
      resolveAudience(
        { mode: 'SOURCE', userIds: [], roles: [], sourceUserIds: ['w1'] },
        members,
      ),
    ).toEqual(['w1']);
  });

  it('SOURCE: resolver users plus extra roles (rule tasks: Owner+Manager and the assignee)', () => {
    expect(
      resolveAudience(
        {
          mode: 'SOURCE',
          userIds: [],
          roles: ['Owner', 'Manager'],
          sourceUserIds: ['w1'],
        },
        members,
      ),
    ).toEqual(['mgr', 'owner', 'w1']);
  });

  it('SOURCE: falls back to Owner + Manager when the assignee is gone or absent', () => {
    expect(
      resolveAudience(
        { mode: 'SOURCE', userIds: [], roles: [], sourceUserIds: ['gone'] },
        members,
      ),
    ).toEqual(['mgr', 'owner']);
    expect(
      resolveAudience({ mode: 'SOURCE', userIds: [], roles: [] }, members),
    ).toEqual(['mgr', 'owner']);
  });

  it('an empty farm resolves to nobody (the caller marks SKIPPED NO_RECIPIENTS)', () => {
    expect(
      resolveAudience({ mode: 'SOURCE', userIds: [], roles: [] }, []),
    ).toEqual([]);
  });

  it('SOURCE ignores the stored display-hint user ids (re-resolved, never trusted)', () => {
    expect(
      resolveAudience(
        { mode: 'SOURCE', userIds: ['gone'], roles: [], sourceUserIds: [] },
        members,
      ),
    ).toEqual(['mgr', 'owner']);
  });
});

describe('validateManualAudience', () => {
  const check = (
    mode: 'SOURCE' | 'USER' | 'USERS' | 'ROLES',
    userIds: string[],
    roles: string[],
    canManage: boolean,
  ) => validateManualAudience({ mode, userIds, roles }, 'me', canManage);

  it('rejects SOURCE for manual schedules', () => {
    expect(check('SOURCE', [], [], true)).toBe('AUDIENCE_SOURCE_NOT_ALLOWED');
  });

  it('Worker (no manage): only USER with self', () => {
    expect(check('USER', ['me'], [], false)).toBeNull();
    expect(check('USER', ['other'], [], false)).toBe('AUDIENCE_FORBIDDEN');
    expect(check('USERS', ['me'], [], false)).toBe('AUDIENCE_FORBIDDEN');
    expect(check('ROLES', [], ['Owner'], false)).toBe('AUDIENCE_FORBIDDEN');
  });

  it('Owner/Manager (manage): may target other users, many users and roles', () => {
    expect(check('USER', ['other'], [], true)).toBeNull();
    expect(check('USERS', ['a', 'b'], [], true)).toBeNull();
    expect(check('ROLES', [], ['Worker'], true)).toBeNull();
  });

  it('checks shape and the 100-recipient cap', () => {
    expect(check('USER', [], [], true)).toBe('AUDIENCE_USER_REQUIRED');
    expect(check('USER', ['a', 'b'], [], true)).toBe('AUDIENCE_USER_REQUIRED');
    expect(check('USERS', [], [], true)).toBe('AUDIENCE_USERS_REQUIRED');
    expect(check('ROLES', [], [], true)).toBe('AUDIENCE_ROLES_REQUIRED');
    const many = Array.from({ length: MAX_RECIPIENTS + 1 }, (_, i) => `u${i}`);
    expect(check('USERS', many, [], true)).toBe('AUDIENCE_TOO_MANY');
    expect(check('USERS', many.slice(0, MAX_RECIPIENTS), [], true)).toBeNull();
  });
});
