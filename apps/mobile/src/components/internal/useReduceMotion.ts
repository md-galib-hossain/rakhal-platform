/**
 * Live "reduce motion" system setting (spec 1.5/1.6). Used by Skeleton (static), Toast and SheetModal (durations 0).
 * Starts `false` until the async read resolves, then follows `reduceMotionChanged`. A failed read keeps `false`
 * (animations are short and opacity/translate only, so the default is safe).
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduce(enabled === true);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      if (active) setReduce(enabled === true);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduce;
}
