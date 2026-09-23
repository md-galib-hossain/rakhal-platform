import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityLogModule,
  NutritionProfile,
  NutritionSource,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import {
  diffNutrition,
  NutrientKey,
  NutritionValues,
  validateNutrition,
} from '../../domain/nutrition-profile';
import { FeedLotResolver } from './feed-lot-resolver.service';

export interface CreateProfileInput {
  values: NutritionValues;
  nutritionSource?: NutritionSource;
  sourceRef?: string | null;
  note?: string | null;
  copiedFromIngredientId?: string | null;
  supersedesId?: string | null;
  /** Skip range validation — only for values copied from the Rakhal catalogue, which is Admin-curated:
   * a quirk in a catalogue row must never block a farm from creating its own feed item. */
  trusted?: boolean;
}

export interface ReviseBatchInput {
  values: NutritionValues;
  nutritionSource?: NutritionSource;
  sourceRef?: string | null;
  note?: string | null;
  /** Optimistic concurrency: the batch `updatedAt` the caller last saw (ISO string). */
  expectedUpdatedAt?: string;
  /** Also make the new profile the product's default for future batches (default true). */
  makeDefault?: boolean;
}

/**
 * Immutable nutrition profiles (MILESTONE 26, RAKHAL-443, ADR-026). Every change **appends** a row —
 * `supersedesId` chains the history, so revert and "what was this lot fed with" are free and no past
 * distribution can be silently rewritten. Validation (D4/D5/D9) happens here, before a value can reach
 * live ration plans. Authorisation is the caller's job (RAKHAL-444 controller: `inventory.update`,
 * manager+); this service is farm-scoped on every read/write.
 */
@Injectable()
export class NutritionProfileService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
    private readonly resolver: FeedLotResolver,
    private readonly activityLog: ActivityLogService,
  ) {
    this.log = logger.setContext(NutritionProfileService.name);
  }

  /** Validates then appends one profile row. `tx` lets a caller fold it into its own transaction. */
  async create(
    farmId: string,
    userId: string,
    input: CreateProfileInput,
    tx?: Prisma.TransactionClient,
  ): Promise<NutritionProfile> {
    const problems = input.trusted ? [] : validateNutrition(input.values);
    if (problems.length > 0) {
      // The global exception filter envelopes only `message`, so the list has to live inside it.
      throw new BadRequestException(
        `Invalid nutrition profile: ${problems.join('; ')}`,
      );
    }
    const client = tx ?? this.prisma;
    if (input.supersedesId) {
      const previous = await client.nutritionProfile.findFirst({
        where: { id: input.supersedesId, farmId },
        select: { id: true },
      });
      if (!previous)
        throw new NotFoundException('Superseded profile not found');
    }
    return client.nutritionProfile.create({
      data: {
        farmId,
        ...input.values,
        nutritionSource: input.nutritionSource ?? 'FARM_ESTIMATE',
        sourceRef: input.sourceRef ?? null,
        note: input.note ?? null,
        copiedFromIngredientId: input.copiedFromIngredientId ?? null,
        supersedesId: input.supersedesId ?? null,
        createdBy: userId,
      },
    });
  }

  /** Copy-once from the Rakhal catalogue (+ the farm's override). No live link is kept. */
  async createFromIngredient(
    farmId: string,
    userId: string,
    ingredientId: string,
    tx?: Prisma.TransactionClient,
    supersedesId?: string,
  ): Promise<NutritionProfile> {
    const catalogue = await this.resolver.catalogueValues(farmId, ingredientId);
    if (!catalogue) throw new NotFoundException('Ingredient not found');
    return this.create(
      farmId,
      userId,
      {
        values: catalogue.values,
        nutritionSource: catalogue.nutritionSource,
        copiedFromIngredientId: ingredientId,
        supersedesId,
        note: 'Copied from the Rakhal catalogue.',
        trusted: true,
      },
      tx,
    );
  }

  async get(farmId: string, id: string): Promise<NutritionProfile> {
    const row = await this.prisma.nutritionProfile.findFirst({
      where: { id, farmId },
    });
    if (!row) throw new NotFoundException('Nutrition profile not found');
    return row;
  }

  /** Newest first: this profile, then each one it superseded (capped — a chain is edit history, not a graph). */
  async history(
    farmId: string,
    id: string,
    limit = 50,
  ): Promise<NutritionProfile[]> {
    const chain: NutritionProfile[] = [];
    let cursor: string | null = id;
    const seen = new Set<string>();
    while (cursor && chain.length < limit && !seen.has(cursor)) {
      seen.add(cursor);
      const row: NutritionProfile | null =
        await this.prisma.nutritionProfile.findFirst({
          where: { id: cursor, farmId },
        });
      if (!row) break;
      chain.push(row);
      cursor = row.supersedesId;
    }
    if (chain.length === 0) {
      throw new NotFoundException('Nutrition profile not found');
    }
    return chain;
  }

  /** For a catalogue-copied profile: which nutrients no longer match today's catalogue+override. Null
   * when the profile was typed by hand (nothing to compare) or the ingredient is gone. */
  async differsFromCatalogue(
    farmId: string,
    profile: NutritionProfile,
  ): Promise<NutrientKey[] | null> {
    if (!profile.copiedFromIngredientId) return null;
    const catalogue = await this.resolver.catalogueValues(
      farmId,
      profile.copiedFromIngredientId,
    );
    if (!catalogue) return null;
    return diffNutrition(this.resolver.toValues(profile), catalogue.values);
  }

  /** Edit a lot's nutrition: appends a new profile that supersedes the current one and repoints the batch. */
  async reviseBatch(
    farmId: string,
    userId: string,
    batchId: string,
    input: ReviseBatchInput,
  ) {
    return this.replaceBatchProfile(farmId, userId, batchId, {
      create: (tx, current) =>
        this.create(
          farmId,
          userId,
          {
            values: input.values,
            nutritionSource: input.nutritionSource,
            sourceRef: input.sourceRef,
            note: input.note,
            copiedFromIngredientId: current.copiedFromIngredientId,
            supersedesId: current.id,
          },
          tx,
        ),
      expectedUpdatedAt: input.expectedUpdatedAt,
      makeDefault: input.makeDefault ?? true,
      action: 'edited',
    });
  }

  /** One-click revert: appends a copy of the previous profile's values (history stays linear and visible). */
  async revertBatch(farmId: string, userId: string, batchId: string) {
    return this.replaceBatchProfile(farmId, userId, batchId, {
      create: async (tx, current) => {
        if (!current.supersedesId) {
          throw new BadRequestException(
            'There is no earlier profile to revert to',
          );
        }
        const previous = await tx.nutritionProfile.findFirst({
          where: { id: current.supersedesId, farmId },
        });
        if (!previous) throw new NotFoundException('Earlier profile not found');
        return this.create(
          farmId,
          userId,
          {
            values: this.resolver.toValues(previous),
            nutritionSource: previous.nutritionSource,
            sourceRef: previous.sourceRef,
            note: `Reverted to the profile from ${previous.createdAt.toISOString().slice(0, 10)}.`,
            copiedFromIngredientId: previous.copiedFromIngredientId,
            supersedesId: current.id,
          },
          tx,
        );
      },
      makeDefault: false,
      action: 'reverted',
    });
  }

  /** Re-copies today's catalogue+override values into a new profile (the "Re-sync" button). */
  async resyncBatch(farmId: string, userId: string, batchId: string) {
    return this.replaceBatchProfile(farmId, userId, batchId, {
      create: async (tx, current) => {
        if (!current.copiedFromIngredientId) {
          throw new BadRequestException(
            'This profile was not copied from a catalogue ingredient',
          );
        }
        return this.createFromIngredient(
          farmId,
          userId,
          current.copiedFromIngredientId,
          tx,
          current.id,
        );
      },
      makeDefault: false,
      action: 're-synced from the catalogue',
    });
  }

  private async replaceBatchProfile(
    farmId: string,
    userId: string,
    batchId: string,
    opts: {
      create: (
        tx: Prisma.TransactionClient,
        current: NutritionProfile,
      ) => Promise<NutritionProfile>;
      expectedUpdatedAt?: string;
      makeDefault: boolean;
      action: string;
    },
  ) {
    const existing = await this.prisma.feedItemBatch.findFirst({
      where: { id: batchId, farmId },
      include: { nutritionProfile: true, feedItem: true },
    });
    if (!existing) throw new NotFoundException('Feed batch not found');
    if (existing.deletedAt || existing.feedItem.deletedAt) {
      throw new BadRequestException(
        'Nutrition cannot be edited on an archived feed item or batch',
      );
    }
    if (
      opts.expectedUpdatedAt &&
      new Date(opts.expectedUpdatedAt).getTime() !==
        existing.updatedAt.getTime()
    ) {
      throw new ConflictException(
        'This batch was changed by someone else — reload and try again',
      );
    }

    const before = this.resolver.toValues(existing.nutritionProfile);
    const result = await this.prisma.$transaction(async (tx) => {
      const profile = await opts.create(tx, existing.nutritionProfile);
      // Guarded against a concurrent edit slipping in between the read above and this write.
      const moved = await tx.feedItemBatch.updateMany({
        where: {
          id: batchId,
          farmId,
          nutritionProfileId: existing.nutritionProfileId,
        },
        data: { nutritionProfileId: profile.id },
      });
      if (moved.count !== 1) {
        throw new ConflictException(
          'This batch was changed by someone else — reload and try again',
        );
      }
      if (opts.makeDefault) {
        await tx.feedItem.update({
          where: { id: existing.feedItemId },
          data: { defaultNutritionProfileId: profile.id },
        });
      }
      return profile;
    });

    const changed = diffNutrition(before, this.resolver.toValues(result));
    await this.audit(
      farmId,
      userId,
      `Feed nutrition ${opts.action}`,
      `${existing.feedItem.name}${existing.batchCode ? ` (lot ${existing.batchCode})` : ''}: ` +
        `profile ${existing.nutritionProfileId} -> ${result.id}` +
        (changed.length > 0 ? `; changed ${changed.join(', ')}` : ''),
    );
    this.log.info('Feed batch nutrition profile replaced', {
      farmId,
      batchId,
      from: existing.nutritionProfileId,
      to: result.id,
      action: opts.action,
    });
    return {
      batch: { id: batchId, nutritionProfileId: result.id },
      profile: result,
    };
  }

  /** An audit-log hiccup must never fail the already-committed nutrition change. */
  private async audit(
    farmId: string,
    actorId: string,
    eventTitle: string,
    actionDetails: string,
  ): Promise<void> {
    try {
      await this.activityLog.record({
        farmId,
        module: ActivityLogModule.INVENTORY,
        eventTitle,
        actionDetails,
        actorId,
      });
    } catch (err) {
      this.log.error('Nutrition activity log failed', {
        farmId,
        eventTitle,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
