/**
 * Pure protocol metrics (RAKHAL-214, PRD §9.8/§9.9, ADR-013). Derives the
 * protocol-card numbers and conception rate from a protocol's instances — keeping
 * the two status tracks distinct: protocol **status** (the process) vs
 * **pregnancy outcome** (the result). No framework/Prisma imports.
 */

export interface InstanceLite {
  status: string; // ReproProtocolStatus
  aiCompletedAt: Date | null;
  pregnancyOutcome: string | null; // ReproPregnancyOutcome
}

export interface ProtocolMetrics {
  applied: number;
  in_progress: number;
  completed: number;
  ai_completed: number;
  pregnant: number;
  open: number;
  pregnancy_loss: number;
  /** Pregnant ÷ Completed × 100 (null until at least one protocol completes). */
  conception_rate: number | null;
}

const IN_PROGRESS_STATUSES = new Set(['DRAFT', 'SCHEDULED', 'IN_PROGRESS']);

export function summarizeProtocol(instances: InstanceLite[]): ProtocolMetrics {
  let in_progress = 0;
  let completed = 0;
  let ai_completed = 0;
  let pregnant = 0;
  let open = 0;
  let pregnancy_loss = 0;

  for (const i of instances) {
    if (IN_PROGRESS_STATUSES.has(i.status)) in_progress += 1;
    if (i.status === 'COMPLETED') completed += 1;
    if (i.aiCompletedAt) ai_completed += 1;
    if (i.pregnancyOutcome === 'PREGNANT') pregnant += 1;
    else if (i.pregnancyOutcome === 'OPEN') open += 1;
    else if (i.pregnancyOutcome === 'PREGNANCY_LOSS') pregnancy_loss += 1;
  }

  return {
    applied: instances.length,
    in_progress,
    completed,
    ai_completed,
    pregnant,
    open,
    pregnancy_loss,
    conception_rate:
      completed > 0 ? Math.round((pregnant / completed) * 1000) / 10 : null,
  };
}
