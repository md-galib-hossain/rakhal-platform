import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { SessionService } from './services/session.service';

describe('AuthService', () => {
  type SuccessfulLoginCall = {
    userId: string;
    refreshTokenHash: string;
    tokenFamily: string;
    ipAddress?: string;
    userAgent?: string;
    deviceName?: string;
  };

  type FailedLoginCall = {
    lockedUntil: Date | null;
  };

  const config = {
    refreshExpiresIn: '30d',
    lockout: {
      maxFailedAttempts: 5,
      durationSeconds: 900,
      windowSeconds: 900,
    },
  } as const;

  let authRepository: {
    findUserByEmail: jest.Mock;
    findUserByUsername: jest.Mock;
    updateUsername: jest.Mock;
    findSafeUserById: jest.Mock;
    recordFailedLoginAttempt: jest.Mock;
    recordSuspiciousLogin: jest.Mock;
    completeSuccessfulLogin: jest.Mock;
  };
  let passwordService: {
    hashPassword: jest.Mock;
    verifyPassword: jest.Mock;
  };
  let refreshTokenService: {
    generateToken: jest.Mock;
    hashToken: jest.Mock;
  };
  let tokenService: {
    signAccessToken: jest.Mock;
  };
  let permissionsVersionCache: {
    set: jest.Mock;
    invalidate: jest.Mock;
  };
  let logger: {
    setContext: jest.Mock;
    audit: jest.Mock;
    warn: jest.Mock;
  };
  let permissionService: {
    invalidateForUser: jest.Mock;
    resolvePermissions: jest.Mock;
  };
  let eventBus: {
    emit: jest.Mock;
  };
  let cacheService: {
    get: jest.Mock;
    set: jest.Mock;
  };
  let service: AuthService;

  beforeEach(() => {
    authRepository = {
      findUserByEmail: jest.fn(),
      findUserByUsername: jest.fn(),
      updateUsername: jest.fn(),
      findSafeUserById: jest.fn(),
      recordFailedLoginAttempt: jest.fn(),
      recordSuspiciousLogin: jest.fn(),
      completeSuccessfulLogin: jest.fn(),
    };
    passwordService = {
      hashPassword: jest.fn(),
      verifyPassword: jest.fn(),
    };
    refreshTokenService = {
      generateToken: jest.fn(),
      hashToken: jest.fn(),
    };
    tokenService = {
      signAccessToken: jest.fn(),
    };
    permissionsVersionCache = {
      set: jest.fn(),
      invalidate: jest.fn(),
    };
    logger = {
      setContext: jest.fn(),
      audit: jest.fn(),
      warn: jest.fn(),
    };
    permissionService = {
      invalidateForUser: jest.fn(),
      resolvePermissions: jest.fn(),
    };
    eventBus = {
      emit: jest.fn(),
    };
    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
    };
    logger.setContext.mockReturnValue(logger);

    service = new AuthService(
      config,
      authRepository,
      passwordService,
      {} as SessionService,
      refreshTokenService,
      permissionsVersionCache,
      permissionService as never,
      tokenService,
      eventBus as never,
      logger as never,
      cacheService as never,
    );
  });

  it('issues a minimal access token and persists the refresh token hash on login', async () => {
    authRepository.findUserByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      name: 'Alice',
      passwordHash: 'hashed-password',
      isEmailVerified: true,
      isBlocked: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
      permissionsVersion: 3,
      deletedAt: null,
    });
    passwordService.verifyPassword.mockResolvedValue(true);
    refreshTokenService.generateToken.mockReturnValue('raw-refresh-token');
    refreshTokenService.hashToken.mockReturnValue('hashed-refresh-token');
    authRepository.completeSuccessfulLogin.mockResolvedValue({
      session: { id: 'session-1' },
    });
    tokenService.signAccessToken.mockResolvedValue('access-token');

    const result = await service.loginWithContext(
      {
        email: 'alice@example.com',
        password: 'correct-password',
        farmId: 'farm-1',
      },
      {
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
        deviceName: 'laptop',
      },
    );

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('raw-refresh-token');
    expect(result.sessionId).toBe('session-1');
    expect(result.user.email).toBe('alice@example.com');
    expect(refreshTokenService.hashToken).toHaveBeenCalledWith(
      'raw-refresh-token',
    );
    const successfulLoginCalls = authRepository.completeSuccessfulLogin.mock
      .calls as SuccessfulLoginCall[][];
    const successfulLoginCall = successfulLoginCalls[0]?.[0];
    expect(successfulLoginCall.userId).toBe('user-1');
    expect(successfulLoginCall.refreshTokenHash).toBe('hashed-refresh-token');
    expect(typeof successfulLoginCall.tokenFamily).toBe('string');
    expect(successfulLoginCall.ipAddress).toBe('127.0.0.1');
    expect(successfulLoginCall.userAgent).toBe('jest');
    expect(successfulLoginCall.deviceName).toBe('laptop');
    expect(tokenService.signAccessToken).toHaveBeenCalledWith({
      sub: 'user-1',
      sessionId: 'session-1',
      farmId: 'farm-1',
      permissionsVersion: 3,
    });
  });

  it('tracks failed login attempts when the password is invalid', async () => {
    authRepository.findUserByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      name: 'Alice',
      passwordHash: 'hashed-password',
      isEmailVerified: true,
      isBlocked: false,
      failedLoginAttempts: 1,
      lockedUntil: null,
      permissionsVersion: 3,
      deletedAt: null,
    });
    passwordService.verifyPassword.mockResolvedValue(false);
    authRepository.recordFailedLoginAttempt.mockResolvedValue(undefined);

    await expect(
      service.loginWithContext({
        email: 'alice@example.com',
        password: 'wrong-password',
        farmId: 'farm-1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(authRepository.recordFailedLoginAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        failedLoginAttempts: 2,
        reason: 'invalid-password',
      }),
    );
  });

  it('RD-043: resets the failed-attempt streak to 1 once the lockout window has elapsed', async () => {
    authRepository.findUserByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      name: 'Alice',
      passwordHash: 'hashed-password',
      isEmailVerified: true,
      isBlocked: false,
      failedLoginAttempts: 4,
      lastFailedLoginAt: new Date(Date.now() - 901_000), // just past the 900s window
      lockedUntil: null,
      permissionsVersion: 3,
      deletedAt: null,
    });
    passwordService.verifyPassword.mockResolvedValue(false);
    authRepository.recordFailedLoginAttempt.mockResolvedValue(undefined);

    await expect(
      service.loginWithContext({
        email: 'alice@example.com',
        password: 'wrong-password',
        farmId: 'farm-1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    // A stale streak starts over at 1, not 5 (which would have locked the account).
    expect(authRepository.recordFailedLoginAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        failedLoginAttempts: 1,
        lockedUntil: null,
        reason: 'invalid-password',
      }),
    );
  });

  it('records a suspicious login when the account is blocked', async () => {
    authRepository.findUserByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      name: 'Alice',
      passwordHash: 'hashed-password',
      isEmailVerified: true,
      isBlocked: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      permissionsVersion: 3,
      deletedAt: null,
    });

    await expect(
      service.loginWithContext({
        email: 'alice@example.com',
        password: 'correct-password',
        farmId: 'farm-1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(authRepository.recordSuspiciousLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        reason: 'blocked-user',
      }),
    );
    expect(authRepository.recordFailedLoginAttempt).not.toHaveBeenCalled();
  });

  it('locks the account after enough invalid attempts', async () => {
    authRepository.findUserByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      name: 'Alice',
      passwordHash: 'hashed-password',
      isEmailVerified: true,
      isBlocked: false,
      failedLoginAttempts: 4,
      lockedUntil: null,
      permissionsVersion: 3,
      deletedAt: null,
    });
    passwordService.verifyPassword.mockResolvedValue(false);

    await expect(
      service.loginWithContext({
        email: 'alice@example.com',
        password: 'wrong-password',
        farmId: 'farm-1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(authRepository.recordFailedLoginAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        failedLoginAttempts: 0,
        reason: 'invalid-password',
      }),
    );
    const failedLoginCalls = authRepository.recordFailedLoginAttempt.mock
      .calls as FailedLoginCall[][];
    const failedLoginCall = failedLoginCalls[0]?.[0];
    expect(failedLoginCall.lockedUntil).toBeInstanceOf(Date);
  });

  describe('username login (WP5b)', () => {
    const user = {
      id: 'user-1',
      email: 'alice@example.com',
      name: 'Alice',
      passwordHash: 'hashed-password',
      isEmailVerified: true,
      isBlocked: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
      permissionsVersion: 3,
      deletedAt: null,
    };

    function primeSuccessfulLogin() {
      passwordService.verifyPassword.mockResolvedValue(true);
      refreshTokenService.generateToken.mockReturnValue('raw-refresh-token');
      refreshTokenService.hashToken.mockReturnValue('hashed-refresh-token');
      authRepository.completeSuccessfulLogin.mockResolvedValue({
        session: { id: 'session-1' },
      });
      tokenService.signAccessToken.mockResolvedValue('access-token');
    }

    it('logs in by username, looked up case-insensitively, and never queries by email', async () => {
      authRepository.findUserByUsername.mockResolvedValue(user);
      primeSuccessfulLogin();

      const result = await service.loginWithContext({
        identifier: '  Rahim.Uddin ',
        password: 'correct-password',
        farmId: 'farm-1',
      });

      expect(authRepository.findUserByUsername).toHaveBeenCalledWith(
        'rahim.uddin',
      );
      expect(authRepository.findUserByEmail).not.toHaveBeenCalled();
      expect(result.accessToken).toBe('access-token');
    });

    it('treats an identifier containing @ as an email', async () => {
      authRepository.findUserByEmail.mockResolvedValue(user);
      primeSuccessfulLogin();

      await service.loginWithContext({
        identifier: 'alice@example.com',
        password: 'correct-password',
        farmId: 'farm-1',
      });

      expect(authRepository.findUserByEmail).toHaveBeenCalledWith(
        'alice@example.com',
      );
      expect(authRepository.findUserByUsername).not.toHaveBeenCalled();
    });

    it('the legacy email field wins over identifier', async () => {
      authRepository.findUserByEmail.mockResolvedValue(user);
      primeSuccessfulLogin();

      await service.loginWithContext({
        email: 'alice@example.com',
        identifier: 'someone-else',
        password: 'correct-password',
        farmId: 'farm-1',
      });

      expect(authRepository.findUserByUsername).not.toHaveBeenCalled();
    });

    it('unknown username is rejected like a wrong password and still spends a hash verify', async () => {
      authRepository.findUserByUsername.mockResolvedValue(null);
      passwordService.hashPassword.mockResolvedValue('dummy-hash');
      passwordService.verifyPassword.mockResolvedValue(false);

      await expect(
        service.loginWithContext({
          identifier: 'nobody',
          password: 'whatever-pass',
        }),
      ).rejects.toThrow('Invalid credentials');

      expect(passwordService.verifyPassword).toHaveBeenCalledWith(
        'dummy-hash',
        'whatever-pass',
      );
      expect(authRepository.recordFailedLoginAttempt).not.toHaveBeenCalled();
    });

    it('a wrong password for a username counts toward the same lockout streak', async () => {
      authRepository.findUserByUsername.mockResolvedValue({
        ...user,
        failedLoginAttempts: 1,
      });
      passwordService.verifyPassword.mockResolvedValue(false);
      authRepository.recordFailedLoginAttempt.mockResolvedValue(undefined);

      await expect(
        service.loginWithContext({
          identifier: 'rahim',
          password: 'wrong-password',
        }),
      ).rejects.toThrow('Invalid credentials');

      expect(authRepository.recordFailedLoginAttempt).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', failedLoginAttempts: 2 }),
      );
    });
  });

  describe('updateUsername (WP5b)', () => {
    it('normalises and saves a valid username', async () => {
      authRepository.findUserByUsername.mockResolvedValue(null);
      authRepository.updateUsername.mockResolvedValue({
        id: 'user-1',
        username: 'rahim.uddin',
      });

      await service.updateUsername('user-1', ' Rahim.Uddin ');

      expect(authRepository.updateUsername).toHaveBeenCalledWith(
        'user-1',
        'rahim.uddin',
      );
    });

    it('rejects bad length, format and reserved names with 400', async () => {
      for (const bad of [
        'ab',
        'a'.repeat(33),
        'has space',
        'a@b.com',
        '.dot',
        'admin',
      ]) {
        await expect(
          service.updateUsername('user-1', bad),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
      expect(authRepository.updateUsername).not.toHaveBeenCalled();
    });

    it('is 409 when another user already holds the name, but idempotent for the owner', async () => {
      authRepository.findUserByUsername.mockResolvedValue({ id: 'user-2' });
      await expect(
        service.updateUsername('user-1', 'rahim'),
      ).rejects.toBeInstanceOf(ConflictException);

      authRepository.findUserByUsername.mockResolvedValue({ id: 'user-1' });
      authRepository.updateUsername.mockResolvedValue({
        id: 'user-1',
        username: 'rahim',
      });
      await expect(
        service.updateUsername('user-1', 'rahim'),
      ).resolves.toBeDefined();
    });

    it('maps a unique-constraint race (P2002) to 409', async () => {
      authRepository.findUserByUsername.mockResolvedValue(null);
      authRepository.updateUsername.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.updateUsername('user-1', 'rahim'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('me', () => {
    it('never includes passwordHash and attaches resolved permissions', async () => {
      authRepository.findSafeUserById.mockResolvedValue({
        id: 'user-1',
        email: 'alice@example.com',
        name: 'Alice',
        isEmailVerified: true,
      });
      permissionService.resolvePermissions.mockResolvedValue([
        'cattle.read',
        'cattle.create',
      ]);

      const result = await service.me('user-1', 'farm-1', 3);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.permissions).toEqual(['cattle.read', 'cattle.create']);
      expect(permissionService.resolvePermissions).toHaveBeenCalledWith(
        'user-1',
        'farm-1',
        3,
      );
    });

    it('degrades to an empty permissions array when resolution fails (e.g. bootstrap farmId)', async () => {
      authRepository.findSafeUserById.mockResolvedValue({
        id: 'user-1',
        email: 'alice@example.com',
        name: 'Alice',
        isEmailVerified: true,
      });
      permissionService.resolvePermissions.mockRejectedValue(
        new Error('no membership'),
      );

      const result = await service.me('user-1', 'bootstrap', 3);

      expect(result.permissions).toEqual([]);
    });
  });
});
