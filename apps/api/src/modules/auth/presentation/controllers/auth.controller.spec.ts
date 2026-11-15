import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { authConfig } from 'src/core/config/env';
import { AuthController } from './auth.controller';
import { AuthService } from '../../application/services/auth.service';
import { CsrfService } from '../../application/services/csrf.service';
import { CsrfGuard } from '../guards/csrf.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { SessionGuard } from '../guards/session.guard';

describe('AuthController', () => {
  let controller: AuthController;
  const authService = {
    register: jest.fn(),
    loginWithContext: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    logoutAll: jest.fn(),
    sessions: jest.fn(),
    revokeSession: jest.fn(),
    me: jest.fn(),
  };

  const config = {
    refreshExpiresIn: '30d',
    refreshCookie: {
      name: 'rakhal_refresh',
      domain: undefined,
      path: '/api/v1/auth',
      sameSite: 'lax',
      secure: false,
      httpOnly: true,
    },
  } as const;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ name: 'default', ttl: 60_000, limit: 1 }],
        }),
      ],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: authConfig.KEY,
          useValue: config,
        },
        {
          provide: CsrfService,
          useValue: {
            generateToken: jest.fn().mockReturnValue('csrf-token'),
            validateRequest: jest.fn().mockReturnValue(true),
          },
        },
      ],
    })
      .overrideGuard(CsrfGuard)
      .useValue({})
      .overrideGuard(JwtAuthGuard)
      .useValue({})
      .overrideGuard(SessionGuard)
      .useValue({})
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('sets the refresh cookie on login and omits it from the response body', async () => {
    authService.loginWithContext.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      sessionId: 'session-1',
      user: {
        id: 'user-1',
        email: 'alice@example.com',
        name: 'Alice',
        isEmailVerified: true,
      },
    });

    const response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    } as never;

    const result = await controller.login(
      {
        email: 'alice@example.com',
        password: 'correct-password',
        farmId: 'farm-1',
      },
      {
        ip: '127.0.0.1',
        headers: {
          'user-agent': 'jest',
          'x-device-name': 'laptop',
        },
      },
      response,
    );

    expect(response.cookie).toHaveBeenCalledWith(
      'rakhal_refresh',
      'refresh-token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/api/v1/auth',
      }),
    );
    expect(result).toEqual({
      accessToken: 'access-token',
      sessionId: 'session-1',
      user: {
        id: 'user-1',
        email: 'alice@example.com',
        name: 'Alice',
        isEmailVerified: true,
      },
    });
  });

  describe('native (X-Client: mobile) clients', () => {
    const user = {
      id: 'user-1',
      email: 'alice@example.com',
      name: 'Alice',
      isEmailVerified: true,
    };
    const makeResponse = () => ({ cookie: jest.fn(), clearCookie: jest.fn() });

    it('returns the refresh token in the login body and sets no cookie', async () => {
      authService.loginWithContext.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        sessionId: 'session-1',
        user,
        farmId: 'farm-1',
        needsFarm: false,
        farms: [],
      });
      const response = makeResponse();

      const result = await controller.login(
        { email: 'alice@example.com', password: 'correct-password' },
        { ip: '127.0.0.1', headers: { 'x-client': 'Mobile' } } as never,
        response as never,
      );

      expect(response.cookie).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('rotates a body refresh token and returns the next one without a cookie', async () => {
      authService.refresh.mockResolvedValue({
        accessToken: 'next-access',
        refreshToken: 'next-refresh',
        sessionId: 'session-1',
        user,
        farmId: 'farm-1',
      });
      const response = makeResponse();

      const result = await controller.refresh(
        { farmId: 'farm-1', refreshToken: 'body-refresh' },
        { cookies: {}, headers: {} } as never,
        response as never,
      );

      expect(authService.refresh).toHaveBeenCalledWith(
        { farmId: 'farm-1', refreshToken: 'body-refresh' },
        'body-refresh',
      );
      expect(response.cookie).not.toHaveBeenCalled();
      expect(result).toMatchObject({ refreshToken: 'next-refresh' });
    });

    it('prefers the cookie over a body token and keeps the cookie contract (browsers)', async () => {
      authService.refresh.mockResolvedValue({
        accessToken: 'next-access',
        refreshToken: 'next-refresh',
        sessionId: 'session-1',
        user,
        farmId: 'farm-1',
      });
      const response = makeResponse();

      const result = await controller.refresh(
        { farmId: 'farm-1', refreshToken: 'ignored-body' },
        { cookies: { rakhal_refresh: 'cookie-refresh' }, headers: {} } as never,
        response as never,
      );

      expect(authService.refresh).toHaveBeenCalledWith(
        { farmId: 'farm-1', refreshToken: 'ignored-body' },
        'cookie-refresh',
      );
      expect(response.cookie).toHaveBeenCalledWith(
        'rakhal_refresh',
        'next-refresh',
        expect.any(Object),
      );
      expect(result).not.toHaveProperty('refreshToken');
    });
  });
});
