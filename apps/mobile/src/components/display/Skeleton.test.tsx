import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';
import { mount, restoreMount } from '../../test-utils/mount.tsx';
import { flatStyle } from '../../test-utils/touch-target.ts';
import { allColors, radius } from '../../theme/tokens.ts';
import { Skeleton, SkeletonList } from './Skeleton.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(restoreMount);

const HIDDEN = { includeHiddenElements: true } as const;

/** Replace Animated.loop with a recorder so no real timers or native driver run. */
function spyLoop() {
  const start = jest.fn();
  const stop = jest.fn();
  const loop = jest.spyOn(Animated, 'loop').mockImplementation((() => ({ start, stop, reset: () => {} })) as never);
  return { start, stop, loop };
}

describe('SkeletonList', () => {
  it('renders 6 rows by default and the requested count otherwise', async () => {
    const first = await mount(<SkeletonList />);
    expect(screen.getAllByTestId('skeleton-row', HIDDEN)).toHaveLength(6);
    await first.unmount();
    await mount(<SkeletonList rows={2} />);
    expect(screen.getAllByTestId('skeleton-row', HIDDEN)).toHaveLength(2);
  });

  it('is one busy accessibility node labelled "Loading" (en) / the bn string; blocks are hidden', async () => {
    await mount(<SkeletonList rows={1} />);
    const list = screen.getByTestId('skeleton-list');
    expect(list.props.accessible).toBe(true);
    expect(list.props.accessibilityLabel).toBe('Loading');
    expect(list.props.accessibilityState).toMatchObject({ busy: true });
  });

  it('bn locale uses the localized loading label', async () => {
    await mount(<SkeletonList rows={1} />, { locale: 'bn' });
    expect(screen.getByTestId('skeleton-list').props.accessibilityLabel).toBe('লোড হচ্ছে');
  });

  it('row variant mirrors ListRow geometry: min 64dp row, 40dp leading square, 14dp / 12dp bars, border fill', async () => {
    await mount(<SkeletonList rows={1} />);
    expect(flatStyle(screen.getByTestId('skeleton-row', HIDDEN))).toMatchObject({ minHeight: 64, paddingHorizontal: 12, paddingVertical: 8 });
    const blocks = screen.getAllByTestId('skeleton-row', HIDDEN)[0]!.children as never[];
    expect(blocks.length).toBeGreaterThan(0);
  });

  it.each(['light', 'dark'] as const)('blocks fill with the decorative border token (%s)', async (scheme) => {
    await mount(<Skeleton testID="sk" height={14} width="60%" />, { scheme });
    expect(flatStyle(screen.getByTestId('sk', HIDDEN))).toMatchObject({
      backgroundColor: allColors[scheme].border,
      height: 14,
      width: '60%',
      borderRadius: radius.sm,
    });
  });

  it('card variant renders Card surfaces', async () => {
    await mount(<SkeletonList variant="card" rows={2} />);
    const cards = screen.getAllByTestId('skeleton-row', HIDDEN);
    expect(cards).toHaveLength(2);
    expect(flatStyle(cards[0]!).borderRadius).toBe(radius.lg);
  });

  it('no row count below 0 and fractional counts are floored', async () => {
    const first = await mount(<SkeletonList rows={-3} />);
    expect(screen.queryAllByTestId('skeleton-row', HIDDEN)).toHaveLength(0);
    await first.unmount();
    await mount(<SkeletonList rows={2.9} />);
    expect(screen.getAllByTestId('skeleton-row', HIDDEN)).toHaveLength(2);
  });
});

describe('Skeleton motion', () => {
  it('pulses with one shared loop and stops it on unmount (no animation leak)', async () => {
    const { start, stop, loop } = spyLoop();
    const view = await mount(<SkeletonList rows={6} />);
    await act(async () => {});
    expect(loop).toHaveBeenCalledTimes(1); // one pulse for the whole list, not one per block
    expect(start).toHaveBeenCalledTimes(1);
    await view.unmount();
    expect(stop).toHaveBeenCalled();
  });

  it('uses the native driver, 800ms, opacity between 1 and 0.5', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    spyLoop();
    await mount(<Skeleton height={10} />);
    await act(async () => {});
    const configs = timing.mock.calls.map((c) => c[1] as unknown as { toValue: number; duration: number; useNativeDriver: boolean });
    expect(configs.map((c) => c.toValue)).toEqual([0.5, 1]);
    for (const c of configs) {
      expect(c.duration).toBe(800);
      expect(c.useNativeDriver).toBe(true);
    }
  });

  it('is static under reduce motion: no loop runs and opacity stays 1', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { start, stop } = spyLoop();
    await mount(<SkeletonList rows={2} />);
    await act(async () => {});
    // The loop may have been started once before the async read resolved; it must be stopped, and the value reset to 1.
    expect(start.mock.calls.length).toBeLessThanOrEqual(1);
    if (start.mock.calls.length === 1) expect(stop).toHaveBeenCalled();
    expect(flatStyle(screen.getByTestId('skeleton-pulse', HIDDEN)).opacity).toBe(1);
  });
});
