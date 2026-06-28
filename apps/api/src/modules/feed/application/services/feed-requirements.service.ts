import { Injectable } from '@nestjs/common';
import { computeRequirements } from '../../domain/requirements';
import { FeedRequirementsQueryDto } from '../../presentation/dto/feed-requirements-query.dto';

/** Nutritional-requirements calculator (PRD §12.4, RAKHAL-081). Thin wrapper over the pure domain. */
@Injectable()
export class FeedRequirementsService {
  calc(query: FeedRequirementsQueryDto) {
    const req = computeRequirements({
      weightKg: query.weightKg,
      milkTargetL: query.milkTargetL,
      milkFatPct: query.milkFatPct,
    });
    return {
      inputs: {
        weight_kg: query.weightKg,
        milk_target_l: query.milkTargetL,
        milk_fat_pct: query.milkFatPct ?? 4.0,
      },
      requirements: {
        dm_kg: req.dmKg,
        cp_kg: req.cpKg,
        me_mj: req.meMj,
        ndf_kg: req.ndfKg,
        fat_kg: req.fatKg,
      },
    };
  }
}
