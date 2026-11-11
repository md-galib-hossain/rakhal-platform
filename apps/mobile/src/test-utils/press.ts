/**
 * Hold / release a Pressable so its INTERNAL pressed state flips (RNTL `fireEvent(el, 'pressIn')` only calls the
 * `onPressIn` prop and never changes the `pressed` flag a style function receives). Drives Pressability through the
 * responder events, the same path a real finger takes. Test-only.
 */
import { act, fireEvent } from '@testing-library/react-native';

type Target = Parameters<typeof fireEvent>[0];

function touchEvent() {
  return {
    persist: () => {},
    // Pressability measures the responder on grant; the jest host has no native methods.
    currentTarget: { measure: () => {}, measureInWindow: () => {}, measureLayout: () => {} },
    nativeEvent: {
      changedTouches: [],
      identifier: 1,
      locationX: 0,
      locationY: 0,
      pageX: 0,
      pageY: 0,
      target: 1,
      timestamp: Date.now(),
      touches: [],
    },
  };
}

export async function pressDown(element: Target): Promise<void> {
  await fireEvent(element, 'responderGrant', touchEvent());
}

/** Release, then wait out RN's minimum pressed duration (130ms) so `pressOut` has been applied. */
export async function pressUp(element: Target): Promise<void> {
  await fireEvent(element, 'responderRelease', touchEvent());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
  });
}
