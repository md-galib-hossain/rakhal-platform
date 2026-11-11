import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';
import { mount, restoreMount } from '../../test-utils/mount.tsx';
import { useReduceMotion } from './useReduceMotion.ts';

function Probe() {
  return <Text testID="rm">{String(useReduceMotion())}</Text>;
}

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(restoreMount);

describe('useReduceMotion', () => {
  it('is false until the system says otherwise', async () => {
    await mount(<Probe />);
    expect(screen.getByTestId('rm').props.children).toBe('false');
  });

  it('reads the initial system value', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await mount(<Probe />);
    await act(async () => {});
    expect(screen.getByTestId('rm').props.children).toBe('true');
  });

  it('follows reduceMotionChanged and unsubscribes on unmount', async () => {
    let listener: ((enabled: boolean) => void) | undefined;
    const remove = jest.fn();
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((event: string, cb: (enabled: boolean) => void) => {
      if (event === 'reduceMotionChanged') listener = cb;
      return { remove };
    }) as never);
    const view = await mount(<Probe />);
    expect(listener).toBeDefined();
    await act(async () => listener!(true));
    expect(screen.getByTestId('rm').props.children).toBe('true');
    await act(async () => listener!(false));
    expect(screen.getByTestId('rm').props.children).toBe('false');
    await view.unmount();
    expect(remove).toHaveBeenCalled();
  });

  it('a failing read keeps false and does not throw', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockRejectedValue(new Error('no a11y service'));
    await mount(<Probe />);
    await act(async () => {});
    expect(screen.getByTestId('rm').props.children).toBe('false');
  });
});
