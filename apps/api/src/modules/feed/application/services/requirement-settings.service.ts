import { HttpStatus, Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { BaseException } from 'src/common/exceptions/base.exception';
import { ExceptionCode } from 'src/common/exceptions/exception-codes.enum';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { CacheService } from 'src/core/cache';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { AuditService } from 'src/modules/audit/application/services/audit.service';
import {
  DEFAULT_REQUIREMENT_SETTINGS,
  mergeSettings,
  parseSettings,
  REQUIREMENT_SETTING_FIELDS,
  RequirementSettings,
  RequirementSettingsChanges,
  validateSettings,
} from '../../domain/requirement-settings';

/** Which layer supplied a setting's effective value. */
export type RequirementSettingSource = 'farm' | 'preset' | 'default';

const CACHE_PREFIX = 'feed:requirement-settings:';
const CACHE_TTL_SECONDS = 300;

/**
 * The seam through which the requirement engine resolves its tuning numbers
 * (RAKHAL-409, PRD §12.13).
 *
 * Mirrors `AqrConfigService` (PRD §19.4) in shape — one provider, resolution order
 * **farm changes -> active preset -> built-in launch defaults** — but backed by real
 * storage rather than that stub's in-memory map. `FeedRequirementsService` depends only
 * on this, never on `DEFAULT_REQUIREMENT_SETTINGS` directly, so the model can be retuned
 * centrally without a redeploy.
 *
 * Changes are **non-retroactive**: nothing already stored is recomputed, and a saved
 * `FeedConcentrationVersion` snapshot is never touched by a settings change.
 *
 * With zero `RequirementPreset` rows every farm falls through to the built-in defaults,
 * so this service is behaviour-neutral until an admin publishes a preset.
 */
@Injectable()
export class RequirementSettingsService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly audit: AuditService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(RequirementSettingsService.name);
  }

  /**
   * The settings this farm's requirement calculations should use.
   *
   * Cached because `FeedConcentrationService.enrich()` runs on every concentration read;
   * a per-request database round-trip there would be a real cost on the list path.
   */
  async resolve(farmId: string): Promise<RequirementSettings> {
    const cached = await this.cache.get<RequirementSettings>(
      this.cacheKey(farmId),
    );
    if (cached) return cached;

    const resolved = (await this.load(farmId)).effective;
    await this.cache.set(this.cacheKey(farmId), resolved, CACHE_TTL_SECONDS);
    return resolved;
  }

  /**
   * The full picture for an editor: the effective values, the layers that produced them,
   * and where each field actually came from.
   */
  async describe(farmId: string) {
    const { effective, preset, farmChanges } = await this.load(farmId);

    return {
      effective,
      defaults: DEFAULT_REQUIREMENT_SETTINGS,
      preset: preset
        ? {
            id: preset.id,
            name: preset.name,
            version: preset.version,
            effective_from: preset.effectiveFrom,
          }
        : null,
      farm_changes: farmChanges,
      sources: this.buildSources(preset?.settings ?? null, farmChanges),
      fields: REQUIREMENT_SETTING_FIELDS,
    };
  }

  /** Upsert this farm's changes. Only the fields supplied are stored; the rest inherit. */
  async saveFarmChanges(
    farmId: string,
    userId: string,
    changes: RequirementSettingsChanges,
    notes?: string,
  ) {
    const issues = validateSettings(changes);
    if (issues.length > 0) {
      // The field list goes in the message as well as `details`: the global filter keeps
      // only code/message/details, and a caller that ignores `details` should still be
      // told which setting it got wrong rather than a bare "not valid".
      const summary = issues
        .map((issue) => `${issue.field} ${issue.message}`)
        .join('; ');
      throw new BaseException({
        code: ExceptionCode.VALIDATION_ERROR,
        statusCode: HttpStatus.BAD_REQUEST,
        message: `Invalid requirement settings: ${summary}`,
        details: { issues },
      });
    }

    const activePreset = await this.activePreset();

    await this.prisma.farmRequirementSettings.upsert({
      where: { farmId },
      create: {
        farmId,
        presetId: activePreset?.id ?? null,
        changes: changes as Prisma.InputJsonValue,
        notes,
        updatedBy: userId,
      },
      update: {
        presetId: activePreset?.id ?? null,
        changes: changes as Prisma.InputJsonValue,
        notes,
        updatedBy: userId,
        deletedAt: null,
      },
    });

    await this.invalidateFarm(farmId);

    // No feed-specific AuditAction exists, and adding one would mean migrating a hot
    // enum. FARM_UPDATED with this entityType says the same thing accurately.
    await this.audit.record({
      actorUserId: userId,
      action: AuditAction.FARM_UPDATED,
      entityType: 'FarmRequirementSettings',
      entityId: farmId,
      farmId,
      metadata: { changed_fields: Object.keys(changes), notes: notes ?? null },
    });

    this.log.info('Farm requirement settings updated', {
      farmId,
      fields: Object.keys(changes).length,
    });

    return this.describe(farmId);
  }

  /** Drop this farm's changes so it inherits the active preset, or the built-in defaults. */
  async resetFarmChanges(farmId: string, userId: string) {
    await this.prisma.farmRequirementSettings.deleteMany({ where: { farmId } });
    await this.invalidateFarm(farmId);

    await this.audit.record({
      actorUserId: userId,
      action: AuditAction.FARM_UPDATED,
      entityType: 'FarmRequirementSettings',
      entityId: farmId,
      farmId,
      metadata: { reset: true },
    });

    this.log.info('Farm requirement settings reset', { farmId });
    return this.describe(farmId);
  }

  /** Drop one farm's cached settings. */
  async invalidateFarm(farmId: string): Promise<void> {
    await this.cache.delete(this.cacheKey(farmId));
  }

  /**
   * Drop every farm's cached settings. Called when an admin activates a preset, which
   * changes the base layer for every tenant at once.
   */
  async invalidateAll(): Promise<void> {
    await this.cache.deleteByPrefix(CACHE_PREFIX);
  }

  // -- Preset management (admin-api, RAKHAL-410) ------------------------------

  /**
   * Every preset, newest first. Admin-facing: farms never choose a preset, they just get
   * whichever one is active.
   */
  async listPresets() {
    const presets = await this.prisma.requirementPreset.findMany({
      where: { deletedAt: null },
      orderBy: [{ isActive: 'desc' }, { effectiveFrom: 'desc' }],
    });

    return {
      presets: presets.map((p) => this.mapPreset(p)),
      built_in_defaults: DEFAULT_REQUIREMENT_SETTINGS,
      fields: REQUIREMENT_SETTING_FIELDS,
    };
  }

  /**
   * Create a preset. Always inactive to begin with, so a new set can be reviewed before it
   * reaches any farm — activation is a separate, deliberate step.
   */
  async createPreset(
    adminId: string,
    input: {
      name: string;
      description?: string;
      settings: RequirementSettingsChanges;
      effectiveFrom?: Date;
    },
  ) {
    this.assertValid(input.settings);

    const previous = await this.prisma.requirementPreset.findFirst({
      where: { name: input.name },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const preset = await this.prisma.requirementPreset.create({
      data: {
        name: input.name,
        description: input.description,
        version: (previous?.version ?? 0) + 1,
        settings: input.settings as Prisma.InputJsonValue,
        effectiveFrom: input.effectiveFrom ?? new Date(),
        isActive: false,
        createdByAdminId: adminId,
      },
    });

    this.log.info('Requirement preset created', {
      presetId: preset.id,
      version: preset.version,
    });
    return this.mapPreset(preset);
  }

  /**
   * Amend a preset that is not live yet. A preset that has been activated is immutable —
   * changing the numbers under a set farms are already using would make the audit trail a
   * lie; publish a new version instead.
   */
  async updatePreset(
    adminId: string,
    presetId: string,
    input: {
      name?: string;
      description?: string;
      settings?: RequirementSettingsChanges;
    },
  ) {
    const existing = await this.getPresetOrThrow(presetId);
    if (existing.isActive) {
      throw new BaseException({
        code: ExceptionCode.CONFLICT,
        statusCode: HttpStatus.CONFLICT,
        message:
          'An active preset cannot be edited. Create a new version and activate that instead.',
      });
    }
    if (input.settings) this.assertValid(input.settings);

    const preset = await this.prisma.requirementPreset.update({
      where: { id: presetId },
      data: {
        name: input.name,
        description: input.description,
        settings: input.settings
          ? (input.settings as Prisma.InputJsonValue)
          : undefined,
      },
    });

    this.log.info('Requirement preset updated', { presetId, adminId });
    return this.mapPreset(preset);
  }

  /**
   * Make this preset the one every farm resolves against.
   *
   * Deactivating the incumbent and activating the replacement happen in one transaction —
   * the partial unique index would reject a second active row anyway, but doing it
   * atomically means there is never a moment with zero active presets either.
   *
   * Non-retroactive (PRD §19.4): nothing already computed is recalculated. Only the cache
   * is dropped, so the next request for each farm picks the new numbers up.
   */
  async activatePreset(adminId: string, presetId: string) {
    const preset = await this.getPresetOrThrow(presetId);

    await this.prisma.$transaction([
      this.prisma.requirementPreset.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      }),
      this.prisma.requirementPreset.update({
        where: { id: presetId },
        data: { isActive: true },
      }),
    ]);

    await this.invalidateAll();

    this.log.info('Requirement preset activated', {
      presetId,
      version: preset.version,
      adminId,
    });
    return this.mapPreset({ ...preset, isActive: true });
  }

  /** What one farm has changed, for admin support visibility. */
  async farmSettingsForAdmin(farmId: string) {
    return this.describe(farmId);
  }

  // -- Private ---------------------------------------------------------------

  private assertValid(settings: RequirementSettingsChanges): void {
    const issues = validateSettings(settings);
    if (issues.length > 0) {
      const summary = issues
        .map((issue) => `${issue.field} ${issue.message}`)
        .join('; ');
      throw new BaseException({
        code: ExceptionCode.VALIDATION_ERROR,
        statusCode: HttpStatus.BAD_REQUEST,
        message: `Invalid requirement settings: ${summary}`,
        details: { issues },
      });
    }
  }

  private async getPresetOrThrow(presetId: string) {
    const preset = await this.prisma.requirementPreset.findFirst({
      where: { id: presetId, deletedAt: null },
    });
    if (!preset) {
      throw new BaseException({
        code: ExceptionCode.NOT_FOUND,
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Requirement preset not found',
      });
    }
    return preset;
  }

  private mapPreset(preset: {
    id: string;
    name: string;
    description: string | null;
    version: number;
    settings: unknown;
    isActive: boolean;
    effectiveFrom: Date;
    createdByAdminId: string | null;
    createdAt: Date;
  }) {
    return {
      id: preset.id,
      name: preset.name,
      description: preset.description,
      version: preset.version,
      settings: preset.settings,
      // What a farm with no changes of its own would actually get.
      effective: parseSettings(preset.settings, DEFAULT_REQUIREMENT_SETTINGS),
      is_active: preset.isActive,
      effective_from: preset.effectiveFrom,
      created_by_admin_id: preset.createdByAdminId,
      created_at: preset.createdAt,
    };
  }

  private cacheKey(farmId: string): string {
    return `${CACHE_PREFIX}${farmId}`;
  }

  private activePreset() {
    return this.prisma.requirementPreset.findFirst({
      where: { isActive: true, deletedAt: null },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  /**
   * Read both layers and fold them onto the built-in defaults.
   *
   * Stored payloads go through `parseSettings`/`cleanChanges`, which drop unknown or
   * out-of-range fields rather than throwing — a malformed row must degrade to the
   * defaults, never take the formulator down.
   */
  private async load(farmId: string) {
    const [preset, farmRow] = await Promise.all([
      this.activePreset(),
      this.prisma.farmRequirementSettings.findFirst({
        where: { farmId, deletedAt: null },
      }),
    ]);

    const base = preset
      ? parseSettings(preset.settings, DEFAULT_REQUIREMENT_SETTINGS)
      : DEFAULT_REQUIREMENT_SETTINGS;

    const farmChanges = farmRow
      ? this.cleanChanges(farmRow.changes)
      : ({} as RequirementSettingsChanges);

    return {
      effective: mergeSettings(base, farmChanges),
      preset,
      farmChanges,
    };
  }

  /** Keep only the stored farm fields that still validate, so one bad field cannot poison the set. */
  private cleanChanges(stored: unknown): RequirementSettingsChanges {
    if (
      typeof stored !== 'object' ||
      stored === null ||
      Array.isArray(stored)
    ) {
      return {};
    }

    const rejected = new Set(
      validateSettings(stored).map((issue) => issue.field.split(/[.[]/)[0]),
    );
    const clean: Record<string, unknown> = {};

    for (const [field, value] of Object.entries(stored)) {
      if (!rejected.has(field)) clean[field] = value;
    }

    return clean;
  }

  /** Tag every field with the layer that supplied its effective value. */
  private buildSources(
    presetSettings: unknown,
    farmChanges: RequirementSettingsChanges,
  ): Record<string, RequirementSettingSource> {
    const presetFields =
      typeof presetSettings === 'object' &&
      presetSettings !== null &&
      !Array.isArray(presetSettings)
        ? new Set(Object.keys(presetSettings))
        : new Set<string>();

    const sources: Record<string, RequirementSettingSource> = {};

    for (const field of Object.keys(DEFAULT_REQUIREMENT_SETTINGS)) {
      if (field in farmChanges) sources[field] = 'farm';
      else if (presetFields.has(field)) sources[field] = 'preset';
      else sources[field] = 'default';
    }

    return sources;
  }
}
