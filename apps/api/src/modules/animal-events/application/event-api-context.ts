import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * RAKHAL-481: set around a handler call made through `POST /cattle/:id/events`.
 * Domain services read it to relax checks that the new event model turns into
 * warnings (hub §3 decision 4) while the legacy routes keep their behaviour
 * until RAKHAL-490.
 */
export interface EventApiContext {
  /** HISTORICAL entries skip stock, finance and task side effects. */
  historical: boolean;
}

const store = new AsyncLocalStorage<EventApiContext>();

export const runInEventApi = <T>(
  ctx: EventApiContext,
  fn: () => Promise<T>,
): Promise<T> => store.run(ctx, fn);

/** The active event-API context, or undefined for legacy route calls. */
export const eventApiContext = (): EventApiContext | undefined =>
  store.getStore();
