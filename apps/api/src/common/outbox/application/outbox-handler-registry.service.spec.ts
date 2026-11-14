import { DomainEventBusService } from 'src/common/events/domain-event-bus.service';
import { OutboxHandlerRegistryService } from './outbox-handler-registry.service';

describe('OutboxHandlerRegistryService', () => {
  let logger: { setContext: jest.Mock; warn: jest.Mock };
  let eventBus: jest.Mocked<Pick<DomainEventBusService, 'emit'>>;

  beforeEach(() => {
    logger = { setContext: jest.fn().mockReturnThis(), warn: jest.fn() };
    eventBus = { emit: jest.fn() };
  });

  it('dispatches to a registered handler for its event type', async () => {
    const registry = new OutboxHandlerRegistryService(
      eventBus as never,
      logger as never,
    );
    const handler = jest.fn().mockResolvedValue(undefined);
    registry.register('sale.recorded', handler);

    await registry.dispatch('sale.recorded', { amount: 100 });

    expect(handler).toHaveBeenCalledWith({ amount: 100 });
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('falls back to the non-throwing DomainEventBus when nothing is registered', async () => {
    const registry = new OutboxHandlerRegistryService(
      eventBus as never,
      logger as never,
    );

    await registry.dispatch('unregistered.event', { x: 1 });

    expect(eventBus.emit).toHaveBeenCalledWith('unregistered.event', { x: 1 });
  });

  it('propagates a registered handler error to the caller (the drainer needs this to retry/dead-letter)', async () => {
    const registry = new OutboxHandlerRegistryService(
      eventBus as never,
      logger as never,
    );
    registry.register('sale.recorded', () => {
      throw new Error('handler boom');
    });

    await expect(registry.dispatch('sale.recorded', {})).rejects.toThrow(
      'handler boom',
    );
  });

  it('warns and overwrites when the same event type is registered twice', () => {
    const registry = new OutboxHandlerRegistryService(
      eventBus as never,
      logger as never,
    );
    registry.register('sale.recorded', jest.fn());
    registry.register('sale.recorded', jest.fn());

    expect(logger.warn).toHaveBeenCalledWith(
      'Overwriting existing outbox handler',
      { eventType: 'sale.recorded' },
    );
  });
});
