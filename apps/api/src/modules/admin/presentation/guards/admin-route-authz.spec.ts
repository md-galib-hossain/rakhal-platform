/* eslint-disable @typescript-eslint/unbound-method -- handlers are passed to the guard as bare functions on purpose */
import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformAdminRole } from '@prisma/client';
import { AdminAuditController } from '../controllers/admin-audit.controller';
import { AdminAdminsController } from '../controllers/admin-admins.controller';
import { AdminDirectoryController } from '../controllers/admin-directory.controller';
import { AdminSupportActionsController } from '../controllers/admin-support-actions.controller';
import { AdminOpsController } from '../controllers/admin-ops.controller';
import { AdminSubscriptionsController } from '../controllers/admin-subscriptions.controller';
import { AdminAnalyticsController } from '../controllers/admin-analytics.controller';
import { AdminConfigController } from '../controllers/admin-config.controller';
import { AdminBillingController } from '../controllers/admin-billing.controller';
import { AdminFeedIngredientController } from '../controllers/admin-feed-ingredient.controller';
import { AdminReconciliationController } from '../controllers/admin-reconciliation.controller';
import { AdminRequirementPresetController } from '../controllers/admin-requirement-preset.controller';
import { AdminSystemController } from '../controllers/admin-system.controller';
import { AdminFeedbackController } from 'src/modules/support/presentation/controllers/admin-feedback.controller';
import { adminRoleHasPermission } from '../../domain/admin-permission-matrix';
import {
  ADMIN_AUTHENTICATED_ONLY_KEY,
  ADMIN_PERMISSION_KEY,
  AdminAuthenticatedOnly,
  RequireAdminPermission,
} from '../decorators/require-admin-permission.decorator';
import { AdminPermissionGuard } from './admin-permission.guard';
import { PlatformAdminGuard } from './platform-admin.guard';
import { AdminIpAllowlistGuard } from './admin-ip-allowlist.guard';
import { AdminAuthController } from '../controllers/admin-auth.controller';

/**
 * Route sweep (P2-02): every route on a guarded admin controller must declare
 * a permission (or the explicit authenticated-only marker), and the controller
 * must run both `PlatformAdminGuard` and `AdminPermissionGuard`. Unguarded
 * controllers by design: `AdminAuthController` (login/2FA) and
 * `AdminHealthController` (public liveness).
 */
const GUARDED_ADMIN_CONTROLLERS = [
  AdminAuditController,
  AdminAdminsController,
  AdminDirectoryController,
  AdminSupportActionsController,
  AdminOpsController,
  AdminSubscriptionsController,
  AdminAnalyticsController,
  AdminConfigController,
  AdminBillingController,
  AdminFeedIngredientController,
  AdminReconciliationController,
  AdminRequirementPresetController,
  AdminSystemController,
  AdminFeedbackController,
];

type Ctor = new (...args: never[]) => unknown;

function routeHandlers(controller: Ctor) {
  const proto = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor')
    .map((name) => ({ name, handler: proto[name] as object }))
    .filter(
      (m) =>
        typeof m.handler === 'function' &&
        Reflect.getMetadata('path', m.handler) !== undefined,
    );
}

describe('admin route authorization sweep', () => {
  it.each(GUARDED_ADMIN_CONTROLLERS.map((c) => [c.name, c as Ctor] as const))(
    '%s runs both admin guards',
    (_name, controller) => {
      const guards = (Reflect.getMetadata('__guards__', controller) ??
        []) as unknown[];
      expect(guards[0]).toBe(AdminIpAllowlistGuard); // first: blocked IPs never reach auth
      expect(guards).toContain(PlatformAdminGuard);
      expect(guards).toContain(AdminPermissionGuard);
    },
  );

  it.each(GUARDED_ADMIN_CONTROLLERS.map((c) => [c.name, c as Ctor] as const))(
    '%s: every route declares a permission',
    (_name, controller) => {
      const handlers = routeHandlers(controller);
      expect(handlers.length).toBeGreaterThan(0);
      const classPerm = Reflect.getMetadata(
        ADMIN_PERMISSION_KEY,
        controller,
      ) as string | undefined;
      for (const { name, handler } of handlers) {
        const perm = Reflect.getMetadata(ADMIN_PERMISSION_KEY, handler) as
          | string
          | undefined;
        const open = Reflect.getMetadata(
          ADMIN_AUTHENTICATED_ONLY_KEY,
          handler,
        ) as boolean | undefined;
        const route = `${controller.name}.${name}`;
        expect({ route, declared: !!(perm || classPerm || open) }).toEqual({
          route,
          declared: true,
        });
      }
    },
  );
});

describe('AdminPermissionGuard (default-deny)', () => {
  class Demo {
    @RequireAdminPermission('user.manage')
    withPerm() {}

    @AdminAuthenticatedOnly()
    open() {}

    undeclared() {}
  }

  const guard = new AdminPermissionGuard(new Reflector());
  const ctx = (
    handler: () => void,
    role: PlatformAdminRole | null,
  ): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => Demo,
      switchToHttp: () => ({
        getRequest: () => ({
          admin: role ? { id: 'a', email: 'a@x.test', role } : undefined,
        }),
      }),
    }) as unknown as ExecutionContext;

  const demo = new Demo();

  it('rejects a route that declares nothing', () => {
    expect(() =>
      guard.canActivate(ctx(demo.undeclared, PlatformAdminRole.SUPER_ADMIN)),
    ).toThrow(ForbiddenException);
  });

  it('allows an explicitly authenticated-only route', () => {
    expect(
      guard.canActivate(ctx(demo.open, PlatformAdminRole.CONTENT_ADMIN)),
    ).toBe(true);
  });

  it('enforces the declared permission by role', () => {
    expect(
      guard.canActivate(ctx(demo.withPerm, PlatformAdminRole.SUPER_ADMIN)),
    ).toBe(true);
    expect(() =>
      guard.canActivate(ctx(demo.withPerm, PlatformAdminRole.BILLING_ADMIN)),
    ).toThrow(ForbiddenException);
  });

  it('rejects when no admin is attached', () => {
    expect(() => guard.canActivate(ctx(demo.open, null))).toThrow(
      ForbiddenException,
    );
  });
});

describe('admin permission matrix', () => {
  it('SUPPORT_ADMIN can triage feedback and revoke sessions but not manage coupons', () => {
    expect(adminRoleHasPermission('SUPPORT_ADMIN', 'feedback.manage')).toBe(
      true,
    );
    expect(adminRoleHasPermission('SUPPORT_ADMIN', 'user.manage')).toBe(true);
    expect(adminRoleHasPermission('SUPPORT_ADMIN', 'coupon.manage')).toBe(
      false,
    );
  });

  it('BILLING_ADMIN and SUPPORT_ADMIN can read plans; CONTENT_ADMIN cannot', () => {
    expect(adminRoleHasPermission('BILLING_ADMIN', 'plan.read')).toBe(true);
    expect(adminRoleHasPermission('SUPPORT_ADMIN', 'plan.read')).toBe(true);
    expect(adminRoleHasPermission('CONTENT_ADMIN', 'plan.read')).toBe(false);
  });

  it('only SUPER_ADMIN reaches an unknown permission', () => {
    expect(adminRoleHasPermission('SUPER_ADMIN', 'anything.at.all')).toBe(true);
    expect(adminRoleHasPermission('CONTENT_ADMIN', 'anything.at.all')).toBe(
      false,
    );
  });
});

describe('admin auth controller (unauthenticated entry points)', () => {
  it('sits behind the IP allowlist like every other admin controller', () => {
    const guards = (Reflect.getMetadata('__guards__', AdminAuthController) ??
      []) as unknown[];
    expect(guards).toContain(AdminIpAllowlistGuard);
  });
});
