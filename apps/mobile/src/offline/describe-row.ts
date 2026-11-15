/**
 * What the pill and the sheet say (WP8b). Pure: message keys and tones only, no React Native import, so
 * `node --test` checks every state. Components turn the keys into text with `t()` and format numbers for the locale.
 */
import type { MessageKey } from '../i18n/messages.ts';
import type { OutboxRow, OutboxStatus } from './outbox.ts';
import type { SyncSnapshot } from './sync-engine.ts';

export type Tone = 'success' | 'warning' | 'destructive' | 'info' | 'neutral';
export type Params = Record<string, string | number>;

export interface Described {
  key: MessageKey;
  params?: Params;
  tone: Tone;
}

/**
 * The one-line state in the header. Order matters: not being able to reach the server beats everything, then what
 * needs the user (review, failed), then progress, then "all sent".
 */
export function describePill(s: Pick<SyncSnapshot, 'state' | 'waiting' | 'failed' | 'conflict'>): Described {
  if (s.state === 'paused') return { key: 'sync.pill.paused', tone: 'warning' };
  if (s.state === 'offline') {
    return s.waiting > 0
      ? { key: 'sync.pill.offlinePending', params: { count: s.waiting }, tone: 'warning' }
      : { key: 'sync.pill.offline', tone: 'neutral' };
  }
  if (s.conflict > 0) return { key: 'sync.pill.review', params: { count: s.conflict }, tone: 'warning' };
  if (s.failed > 0) return { key: 'sync.pill.failed', params: { count: s.failed }, tone: 'destructive' };
  if (s.state === 'syncing') return { key: 'sync.pill.syncing', tone: 'info' };
  if (s.waiting > 0) return { key: 'sync.pill.pending', params: { count: s.waiting }, tone: 'info' };
  return { key: 'sync.pill.synced', tone: 'success' };
}

const STATUS: Record<OutboxStatus, { key: MessageKey; tone: Tone }> = {
  pending: { key: 'sync.status.waiting', tone: 'neutral' },
  sending: { key: 'sync.status.sending', tone: 'info' },
  failed: { key: 'sync.status.failed', tone: 'destructive' },
  conflict: { key: 'sync.status.conflict', tone: 'warning' },
  done: { key: 'sync.status.done', tone: 'success' },
};

export function describeStatus(status: OutboxStatus): { key: MessageKey; tone: Tone } {
  return STATUS[status];
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/** A short title for a queued write. `date` is the raw day (YYYY-MM-DD); the component formats it. */
export function describeRow(row: Pick<OutboxRow, 'endpoint' | 'body'>): { key: MessageKey; params?: Params; date?: string; count?: number } {
  const body = record(row.body);
  switch (row.endpoint) {
    case 'milk.saveLog': {
      const entries = Array.isArray(body.entries) ? body.entries.length : 0;
      return { key: 'sync.item.milkSave', count: entries, date: typeof body.date === 'string' ? body.date : undefined };
    }
    case 'milk.submit':
      return { key: 'sync.item.milkSubmit', date: typeof body.date === 'string' ? body.date : undefined };
    case 'health.createCase':
      return { key: 'sync.item.sickness' };
    case 'task.complete':
      return { key: 'sync.item.taskComplete' };
    default:
      return { key: 'sync.item.generic' };
  }
}

/** How many entries of a conflicted write the server kept its own version of. */
export function conflictCount(row: Pick<OutboxRow, 'conflict'>): number {
  return Array.isArray(row.conflict) ? row.conflict.length : 0;
}
