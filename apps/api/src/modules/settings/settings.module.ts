import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { emailConfig } from 'src/core/config/env';
import { PrismaModule } from 'src/core/database/prisma/prisma.module';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { AuditModule } from '../audit/audit.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { EmailModule } from '../email/email.module';
import { SettingsService } from './application/services/settings.service';
import { RolesService } from './application/services/roles.service';
import { TeamService } from './application/services/team.service';
import { WorkspaceSettingsService } from './application/services/workspace-settings.service';
import { SettingsController } from './presentation/controllers/settings.controller';
import { RolesController } from './presentation/controllers/roles.controller';
import { TeamController } from './presentation/controllers/team.controller';
import { WorkspaceSettingsController } from './presentation/controllers/workspace-settings.controller';

@Module({
  imports: [
    PrismaModule,
    LoggerModule,
    AuthModule,
    TenantAccessModule,
    PermissionModule,
    AuditModule,
    SubscriptionModule,
    EmailModule,
    ConfigModule.forFeature(emailConfig),
  ],
  controllers: [
    SettingsController,
    RolesController,
    TeamController,
    WorkspaceSettingsController,
  ],
  providers: [
    SettingsService,
    RolesService,
    TeamService,
    WorkspaceSettingsService,
  ],
  exports: [
    SettingsService,
    RolesService,
    TeamService,
    WorkspaceSettingsService,
  ],
})
export class SettingsModule {}
