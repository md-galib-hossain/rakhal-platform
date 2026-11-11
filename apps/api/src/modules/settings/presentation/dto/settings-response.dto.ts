import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { FarmStatus, PermissionGroup, ShedPurpose } from '@prisma/client';
import type { RolesService } from '../../application/services/roles.service';
import type { SettingsService } from '../../application/services/settings.service';
import type { TeamService } from '../../application/services/team.service';
import type { WorkspaceSettingsService } from '../../application/services/workspace-settings.service';

/**
 * Documented response shapes for the settings routes typed under RD-140 (farm, sheds, team, roles and the
 * workspace settings: modules, billing, suppliers, service providers). Each class mirrors what the service
 * really returns and is pinned to it by a compile-time guard at the bottom of this file, so a change in a
 * service (or a Prisma column) fails `nest build` until this file follows. These services build most
 * responses by hand, so keys are snake_case; the shed create/update routes return a raw Prisma row and stay
 * camelCase. `Date` fields are ISO-8601 strings on the wire.
 */

const DATE_TIME = { type: String, format: 'date-time' } as const;
const NULLABLE_STRING = { type: String, nullable: true } as const;
const NULLABLE_NUMBER = { type: Number, nullable: true } as const;

// ─── Shared ────────────────────────────────────────────────────────────────

/** Result of a soft delete: the row is archived, not removed. */
export class SoftDeleteResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty(DATE_TIME) deleted_at!: Date;
}

// ─── Farm ──────────────────────────────────────────────────────────────────

class FarmSettingsBaseDto {
  @ApiProperty() timezone!: string;
  @ApiProperty() farm_id!: string;
  @ApiProperty() farm_slug!: string;
  @ApiProperty() farm_name!: string;
  @ApiProperty(NULLABLE_STRING) description!: string | null;
  @ApiProperty(NULLABLE_STRING) division!: string | null;
  @ApiProperty(NULLABLE_STRING) district!: string | null;
  @ApiProperty(NULLABLE_STRING) upazila!: string | null;
  @ApiProperty(NULLABLE_STRING) operational_purpose!: string | null;
  @ApiProperty(NULLABLE_STRING) phone!: string | null;
  @ApiProperty(NULLABLE_STRING) address!: string | null;
}

export class FarmSettingsResponseDto extends FarmSettingsBaseDto {
  @ApiProperty({ enum: FarmStatus, enumName: 'FarmStatus' })
  status!: FarmStatus;
}

/** `PATCH /settings/farm` returns `status` as a plain string (not the enum). */
export class FarmUpdateResponseDto extends FarmSettingsBaseDto {
  @ApiProperty() status!: string;
}

// ─── Sheds ─────────────────────────────────────────────────────────────────

export class ShedResponsibleMemberDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

/** One row of `GET /settings/sheds`. */
export class ShedListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() code!: string;
  @ApiProperty(NULLABLE_STRING) description!: string | null;
  @ApiProperty(NULLABLE_NUMBER) capacity!: number | null;
  @ApiProperty({ enum: ShedPurpose, enumName: 'ShedPurpose' })
  purpose!: ShedPurpose;
  @ApiProperty({ type: () => ShedResponsibleMemberDto, nullable: true })
  responsible_member!: ShedResponsibleMemberDto | null;
  @ApiProperty({ description: 'Animals currently in this shed.' })
  current_count!: number;
  @ApiProperty({ ...DATE_TIME, nullable: true }) deleted_at!: Date | null;
  @ApiProperty(DATE_TIME) created_at!: Date;
}

/** `POST` / `PATCH /settings/sheds`: the raw shed row (camelCase). */
export class ShedResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() code!: string;
  @ApiProperty(NULLABLE_STRING) description!: string | null;
  @ApiProperty(NULLABLE_NUMBER) capacity!: number | null;
  @ApiProperty({ enum: ShedPurpose, enumName: 'ShedPurpose' })
  purpose!: ShedPurpose;
  @ApiProperty({ ...DATE_TIME, nullable: true }) deletedAt!: Date | null;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
  @ApiProperty() farmId!: string;
  @ApiProperty(NULLABLE_STRING) responsibleMemberId!: string | null;
}

// ─── Team ──────────────────────────────────────────────────────────────────

export class TeamMemberDto {
  @ApiProperty() id!: string;
  @ApiProperty() member_id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true, description: 'Always null.' })
  phone!: null;
  @ApiProperty() email!: string;
  @ApiProperty() role!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ ...DATE_TIME, nullable: true })
  last_active_at!: Date | null;
  @ApiProperty() is_owner!: boolean;
}

/** A pending invitation, listed alongside the members. */
export class TeamInviteRowDto {
  @ApiProperty() id!: string;
  @ApiProperty() invite_id!: string;
  @ApiProperty(NULLABLE_STRING) name!: string | null;
  @ApiProperty(NULLABLE_STRING) phone!: string | null;
  @ApiProperty() email!: string;
  @ApiProperty() role!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ type: String, nullable: true, description: 'Always null.' })
  last_active_at!: null;
  @ApiProperty(DATE_TIME) expires_at!: Date;
}

@ApiExtraModels(TeamMemberDto, TeamInviteRowDto)
export class TeamListResponseDto {
  @ApiProperty({
    type: 'array',
    description: 'Active members and pending invites, in one list.',
    items: {
      oneOf: [
        { $ref: getSchemaPath(TeamMemberDto) },
        { $ref: getSchemaPath(TeamInviteRowDto) },
      ],
    },
  })
  members!: (TeamMemberDto | TeamInviteRowDto)[];
}

export class TeamInviteResponseDto {
  @ApiProperty() invite_id!: string;
  @ApiProperty() sms_sent!: boolean;
  @ApiProperty(DATE_TIME) expires_at!: Date;
}

export class TeamChangeRoleResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() role!: string;
}

export class TeamRemoveMemberResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() removed!: boolean;
}

export class TeamRevokeInviteResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() revoked!: boolean;
}

// ─── Roles ─────────────────────────────────────────────────────────────────

export class ResourcePermissionsDto {
  @ApiProperty({ enum: PermissionGroup, enumName: 'PermissionGroup' })
  group!: PermissionGroup;
  @ApiProperty({ description: 'Resource segment of the key, e.g. `cattle`.' })
  resource!: string;
  @ApiProperty({ type: [String], description: 'Actions available on it.' })
  actions!: string[];
}

export class PermissionCatalogueResponseDto {
  @ApiProperty({ type: () => [ResourcePermissionsDto] })
  permissions!: ResourcePermissionsDto[];
}

export class RoleResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty(NULLABLE_STRING) description!: string | null;
  @ApiProperty() is_system!: boolean;
  @ApiProperty({ description: 'False for built-in roles.' })
  editable!: boolean;
  @ApiProperty() member_count!: number;
  @ApiProperty({ type: [String] }) permission_keys!: string[];
  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'object',
      additionalProperties: { type: 'boolean' },
    },
    description: 'resource -> action -> allowed.',
  })
  matrix!: Record<string, Record<string, boolean>>;
}

export class RoleListResponseDto {
  @ApiProperty({ type: () => [RoleResponseDto] }) roles!: RoleResponseDto[];
  @ApiProperty({ type: () => [ResourcePermissionsDto] })
  catalogue!: ResourcePermissionsDto[];
}

export class DeleteRoleResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() deleted!: boolean;
}

// ─── Workspace: suppliers and service providers ────────────────────────────

export class SupplierResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty(NULLABLE_STRING) contact!: string | null;
  @ApiProperty(NULLABLE_STRING) phone!: string | null;
  @ApiProperty(NULLABLE_STRING) category!: string | null;
  @ApiProperty(NULLABLE_STRING) payment_terms!: string | null;
  @ApiProperty() payment_terms_days!: number;
  @ApiProperty(NULLABLE_STRING) notes!: string | null;
  @ApiProperty({ ...DATE_TIME, nullable: true }) deleted_at!: Date | null;
}

export class SupplierListResponseDto {
  @ApiProperty({ type: () => [SupplierResponseDto] })
  suppliers!: SupplierResponseDto[];
}

export class ServiceProviderResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty(NULLABLE_STRING) phone!: string | null;
  @ApiProperty() type!: string;
  @ApiProperty({ ...DATE_TIME, nullable: true }) deleted_at!: Date | null;
}

export class ServiceProviderListResponseDto {
  @ApiProperty({ type: () => [ServiceProviderResponseDto] })
  service_providers!: ServiceProviderResponseDto[];
}

// ─── Workspace: billing ────────────────────────────────────────────────────

export class BillingPlanDto {
  @ApiProperty() name!: string;
  @ApiProperty() price_per_month!: number;
  @ApiProperty() currency!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ ...DATE_TIME, nullable: true })
  next_billing_date!: Date | null;
}

export class BillingResponseDto {
  @ApiProperty({ type: () => BillingPlanDto, nullable: true })
  current_plan!: BillingPlanDto | null;
  @ApiProperty({
    type: Object,
    nullable: true,
    description: 'Always null today: payment methods are not stored yet.',
  })
  payment_method!: null;
  @ApiProperty({
    type: [Object],
    description: 'Always empty today: invoices are not listed here yet.',
  })
  invoices!: never[];
}

// ─── Workspace: modules ────────────────────────────────────────────────────

/** Milking-session settings; also nested under `milk` in the modules response. */
export class MilkSessionsSettingsDto {
  @ApiProperty({ type: [String] }) active_sessions!: string[];
  @ApiProperty() morning_start!: string;
  @ApiProperty() morning_end!: string;
  @ApiProperty() noon_start!: string;
  @ApiProperty() noon_end!: string;
  @ApiProperty() evening_start!: string;
  @ApiProperty() evening_end!: string;
  @ApiProperty() night_start!: string;
  @ApiProperty() night_end!: string;
  @ApiProperty() milk_unit!: string;
  @ApiProperty() anomaly_threshold_pct!: number;
  @ApiProperty() colostrum_window_days!: number;
}

export class ModulesCattleDto {
  @ApiProperty() id_format!: string;
  @ApiProperty(NULLABLE_STRING) tag_prefix!: string | null;
  @ApiProperty(NULLABLE_STRING)
  avg_daily_milk_target_range!: string | null;
}

export class ModulesReproductionDto {
  @ApiProperty() vwp_days!: number;
  @ApiProperty() pregnancy_check_days!: number;
  @ApiProperty() target_calving_interval_days!: number;
  @ApiProperty() dry_period_target_days!: number;
}

export class ModulesFinanceDto {
  @ApiProperty() currency!: string;
  @ApiProperty() currency_symbol!: string;
  @ApiProperty() survival_runway_warning_days!: number;
  @ApiProperty() survival_runway_critical_days!: number;
  @ApiProperty() financial_year_start_month!: number;
}

export class ModulesHealthDto {
  @ApiProperty() herd_health_score_warning_pct!: number;
  @ApiProperty() scc_alert_threshold!: number;
  @ApiProperty() morbidity_outbreak_threshold_pct!: number;
}

export class ModulesSettingsResponseDto {
  @ApiProperty({ type: () => ModulesCattleDto }) cattle!: ModulesCattleDto;
  @ApiProperty({ type: () => MilkSessionsSettingsDto })
  milk!: MilkSessionsSettingsDto;
  @ApiProperty({ type: () => ModulesReproductionDto })
  reproduction!: ModulesReproductionDto;
  @ApiProperty({ type: () => ModulesFinanceDto }) finance!: ModulesFinanceDto;
  @ApiProperty({ type: () => ModulesHealthDto }) health!: ModulesHealthDto;
}

// ─── Compile-time guards (RD-140) ───────────────────────────────────────────
// Each fails `nest build` if the service's real return type and the documented class diverge.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Ret<S, K extends keyof S> = S[K] extends (...args: never[]) => infer R
  ? Awaited<R>
  : never;

type Set = SettingsService;
type Team = TeamService;
type Role = RolesService;
type Ws = WorkspaceSettingsService;

export type SettingsShapeGuards = [
  // farm and sheds
  Assert<Same<Ret<Set, 'getFarm'>, FarmSettingsResponseDto>>,
  Assert<Same<Ret<Set, 'updateFarm'>, FarmUpdateResponseDto>>,
  Assert<Same<Ret<Set, 'listSheds'>, ShedListItemDto[]>>,
  Assert<Same<Ret<Set, 'createShed'>, ShedResponseDto>>,
  Assert<Same<Ret<Set, 'updateShed'>, ShedResponseDto>>,
  Assert<Same<Ret<Set, 'deleteShed'>, SoftDeleteResponseDto>>,
  // team
  Assert<Same<Ret<Team, 'listTeam'>, TeamListResponseDto>>,
  Assert<Same<Ret<Team, 'invite'>, TeamInviteResponseDto>>,
  Assert<Same<Ret<Team, 'resendInvite'>, TeamInviteResponseDto>>,
  Assert<Same<Ret<Team, 'changeRole'>, TeamChangeRoleResponseDto>>,
  Assert<Same<Ret<Team, 'removeMember'>, TeamRemoveMemberResponseDto>>,
  Assert<Same<Ret<Team, 'revokeInvite'>, TeamRevokeInviteResponseDto>>,
  // roles
  Assert<Same<Ret<Role, 'listRoles'>, RoleListResponseDto>>,
  Assert<Same<Ret<Role, 'getCatalogue'>, PermissionCatalogueResponseDto>>,
  Assert<Same<Ret<Role, 'createRole'>, RoleResponseDto>>,
  Assert<Same<Ret<Role, 'updateRolePermissions'>, RoleResponseDto>>,
  Assert<Same<Ret<Role, 'deleteRole'>, DeleteRoleResponseDto>>,
  // workspace
  Assert<Same<Ret<Ws, 'getModules'>, ModulesSettingsResponseDto>>,
  Assert<Same<Ret<Ws, 'updateModules'>, ModulesSettingsResponseDto>>,
  Assert<Same<Ret<Ws, 'updateMilkSessions'>, MilkSessionsSettingsDto>>,
  Assert<Same<Ret<Ws, 'getBilling'>, BillingResponseDto>>,
  Assert<Same<Ret<Ws, 'listSuppliers'>, SupplierListResponseDto>>,
  Assert<Same<Ret<Ws, 'createSupplier'>, SupplierResponseDto>>,
  Assert<Same<Ret<Ws, 'updateSupplier'>, SupplierResponseDto>>,
  Assert<Same<Ret<Ws, 'deleteSupplier'>, SoftDeleteResponseDto>>,
  Assert<Same<Ret<Ws, 'listServiceProviders'>, ServiceProviderListResponseDto>>,
  Assert<Same<Ret<Ws, 'createServiceProvider'>, ServiceProviderResponseDto>>,
  Assert<Same<Ret<Ws, 'updateServiceProvider'>, ServiceProviderResponseDto>>,
  Assert<Same<Ret<Ws, 'deleteServiceProvider'>, SoftDeleteResponseDto>>,
];
