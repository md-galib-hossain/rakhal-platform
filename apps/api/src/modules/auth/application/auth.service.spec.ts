import { UnauthorizedException } from '@nestjs/common';
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
    },
  } as const;

  let authRepository: {
    findUserByEmail: jest.Mock;
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
  };
  let eventBus: {
    emit: jest.Mock;
  };
  let service: AuthService;

  beforeEach(() => {
    authRepository = {
      findUserByEmail: jest.fn(),
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
    };
    eventBus = {
      emit: jest.fn(),
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
});
