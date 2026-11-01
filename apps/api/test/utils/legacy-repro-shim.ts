import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { json } from 'express';

/**
 * RAKHAL-490: the old `POST /reproduction/{heat,breeding,calving,abortion}-events`,
 * `pregnancy-diagnoses` and `cattle/:id/dry-off` routes are gone. This test-only
 * shim rewrites those calls onto `POST /cattle/:id/events` and unwraps the
 * response to the bare detail row the old routes returned, so the lifecycle
 * specs keep exercising the same services through the one real write path.
 * Provenance is pinned to RECORDED so old-dated fixtures keep their costing.
 */
const TYPES: Record<string, { type: string; dateKey: string }> = {
  'heat-events': { type: 'HEAT', dateKey: 'heatDateTime' },
  'breeding-events': { type: 'BREEDING', dateKey: 'breedingDate' },
  'pregnancy-diagnoses': { type: 'PREG_CHECK', dateKey: 'diagnosisDate' },
  'calving-events': { type: 'CALVING', dateKey: 'calvingDate' },
  'abortion-events': { type: 'ABORTION', dateKey: 'abortionDate' },
};

export function installLegacyReproShim(app: INestApplication): void {
  const parse = json();
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'POST') return next();
    const url = req.url.split('?')[0];
    const m =
      /^(\/[^/]+\/[^/]+)\/reproduction\/(heat-events|breeding-events|pregnancy-diagnoses|calving-events|abortion-events)\/?$/.exec(
        url,
      ) ??
      /^(\/[^/]+\/[^/]+)\/reproduction\/cattle\/([^/]+)\/dry-off\/?$/.exec(url);
    if (!m) return next();
    parse(req, res, (err?: unknown) => {
      if (err) return next(err as Error);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const prefix = m[1];
      let cattleId: unknown;
      let spec: { type: string; dateKey: string };
      if (m[2] in TYPES) {
        spec = TYPES[m[2]];
        cattleId = body.cattleId;
      } else {
        spec = { type: 'DRY_OFF', dateKey: 'dryOffDate' };
        cattleId = m[2];
      }
      const { [spec.dateKey]: at, cattleId: _c, ...payload } = body;
      void _c;
      req.url = `${prefix}/cattle/${String(cattleId)}/events`;
      req.body = {
        type: spec.type,
        eventAt: at ?? new Date().toISOString(),
        provenance: 'RECORDED',
        payload,
      };
      const origJson = res.json.bind(res);
      res.json = ((b: unknown) => {
        const env = b as { data?: { detail?: unknown; event?: unknown } };
        if (env?.data && 'detail' in env.data && 'event' in env.data) {
          return origJson({ ...env, data: env.data.detail });
        }
        return origJson(b);
      }) as typeof res.json;
      next();
    });
  });
}
