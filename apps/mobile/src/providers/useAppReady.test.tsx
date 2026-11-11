import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook } from '@testing-library/react-native';

const mockUseFonts = jest.fn<(...a: unknown[]) => [boolean, Error | null]>();
const mockPrevent = jest.fn<() => Promise<boolean>>();
const mockHide = jest.fn<() => Promise<boolean>>();

jest.mock('expo-font', () => ({ useFonts: (...a: unknown[]) => mockUseFonts(...a) }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: () => mockPrevent(),
  hideAsync: () => mockHide(),
}));

import { requiredFontFamilies } from '../theme/font-manifest.ts';
import { fontAssets } from '../theme/fonts.ts';
import { holdSplash, releaseSplash, useFontsReady, useSplashRelease } from './useAppReady.ts';

describe('fontAssets', () => {
  it('has exactly the manifest families (so tokens and loader cannot drift)', () => {
    expect(Object.keys(fontAssets).sort()).toEqual([...requiredFontFamilies].sort());
  });
});

describe('font loader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrevent.mockResolvedValue(true);
    mockHide.mockResolvedValue(true);
  });

  it('passes fontAssets to useFonts and is not ready while loading', async () => {
    mockUseFonts.mockReturnValue([false, null]);
    const { result } = await renderHook(() => useFontsReady());
    expect(mockUseFonts).toHaveBeenCalledWith(fontAssets);
    expect(result.current).toBe(false);
  });

  it('is ready when loaded', async () => {
    mockUseFonts.mockReturnValue([true, null]);
    const { result } = await renderHook(() => useFontsReady());
    expect(result.current).toBe(true);
  });

  it('is ready on error (never bricks) and logs it', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockUseFonts.mockReturnValue([false, new Error('boom')]);
    const { result } = await renderHook(() => useFontsReady());
    expect(result.current).toBe(true);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('holdSplash/releaseSplash call expo-splash-screen and swallow rejections', async () => {
    mockPrevent.mockRejectedValue(new Error('x'));
    mockHide.mockRejectedValue(new Error('y'));
    holdSplash();
    releaseSplash();
    await Promise.resolve();
    expect(mockPrevent).toHaveBeenCalledTimes(1);
    expect(mockHide).toHaveBeenCalledTimes(1);
  });

  it('useSplashRelease hides only once ready', async () => {
    const { rerender } = await renderHook(({ ready }: { ready: boolean }) => useSplashRelease(ready), {
      initialProps: { ready: false },
    });
    expect(mockHide).not.toHaveBeenCalled();
    await rerender({ ready: true });
    expect(mockHide).toHaveBeenCalledTimes(1);
  });
});
