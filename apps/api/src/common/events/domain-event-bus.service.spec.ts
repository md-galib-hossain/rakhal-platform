import { DomainEventBusService } from './domain-event-bus.service';

describe('DomainEventBusService', () => {
  let logger: { setContext: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    logger = {
      setContext: jest.fn().mockReturnThis(),
      error: jest.fn(),
    };
  });

  it('does not propagate a synchronously throwing listener', () => {
    const bus = new DomainEventBusService(logger as never);

    bus.on('test.event', () => {
      throw new Error('boom');
    });

    expect(() => bus.emit('test.event', { id: 1 })).not.toThrow();
    expect(logger.error).toHaveBeenCalledWith(
      'Listener for "test.event" threw',
      expect.any(Error),
    );
  });

  it('does not leave an unhandled rejection when an async listener rejects', async () => {
    const bus = new DomainEventBusService(logger as never);

    bus.on('test.event', async () => {
      await Promise.resolve();
      throw new Error('boom async');
    });

    expect(() => bus.emit('test.event', { id: 1 })).not.toThrow();

    // Flush the microtask queue so the rejection has a chance to be (un)handled.
    await new Promise((resolve) => setImmediate(resolve));

    expect(logger.error).toHaveBeenCalledWith(
      'Listener for "test.event" rejected',
      expect.any(Error),
    );
  });

  it('still runs every other listener when one throws', () => {
    const bus = new DomainEventBusService(logger as never);
    const goodListener = jest.fn();

    bus.on('test.event', () => {
      throw new Error('boom');
    });
    bus.on('test.event', goodListener);

    bus.emit('test.event', { id: 1 });

    expect(goodListener).toHaveBeenCalledWith({ id: 1 });
  });

  it('off() removes the wrapped listener so it stops receiving events', () => {
    const bus = new DomainEventBusService(logger as never);
    const listener = jest.fn();

    bus.on('test.event', listener);
    bus.off('test.event', listener);
    bus.emit('test.event', { id: 1 });

    expect(listener).not.toHaveBeenCalled();
  });
});
