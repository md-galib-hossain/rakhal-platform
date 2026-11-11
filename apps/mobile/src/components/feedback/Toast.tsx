/**
 * Toast + ToastProvider + useToast (spec 2.11). One toast at a time: `show` replaces the current one and returns its
 * id. Callers pass already-formatted strings (undo: `{ message, action: { label: t('toast.undo'), onPress: revert } }`;
 * pressing the action runs `onPress` then dismisses).
 *
 * - Surface: `popover` fill, `inputBorder` outline, `radius.lg`, `elevation.overlay`, minHeight 56, `spacing.lg` side
 *   margins, `insets.bottom + 16 + bottomOffset` above the bottom (`bottomOffset` per toast, else the provider default,
 *   so a screen with a sticky bar / the tab bar can clear it).
 * - Timing (toast-timing.ts): 4s plain, 5s with action, 6s error, 0 = persistent (shows a close IconButton). For
 *   screen-reader users the window is extended (Android recommended timeout, else x3). Touches never cancel the timer.
 * - A11y: live region polite (assertive for error), `alert` role for error, plus one announceForAccessibility on show.
 * - Motion: enter 180ms translateY 16 -> 0 + fade, exit 120ms fade; reduce motion = instant. Native driver.
 *
 * SPIKE V-C4 (device): Animated native driver, the Android getRecommendedTimeoutMillis path and live-region
 * announcements in Expo Go are implemented per spec and NOT verified on a device (jest only).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '../../providers/LocaleProvider.tsx';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import { elevation, radius, shadowColor, spacing, type AnyColorName } from '../../theme/tokens.ts';
import { Button } from '../actions/Button.tsx';
import { IconButton } from '../actions/IconButton.tsx';
import { Glyph, type GlyphName } from '../internal/Glyph.tsx';
import { useReduceMotion } from '../internal/useReduceMotion.ts';
import { Text } from '../primitives/Text.tsx';
import {
  TOAST_ENTER_OFFSET,
  baseToastDuration,
  effectiveToastDuration,
  isPersistent,
  replaceToast,
  toastBottom,
  toastDurations,
  toastLiveRegion,
  type ToastTone,
} from './toast-timing.ts';

export type { ToastTone } from './toast-timing.ts';

export interface ToastOptions {
  message: string;
  /** Default 'success'. */
  tone?: ToastTone;
  action?: { label: string; onPress: () => void };
  /** Overrides the per-kind default; 0 = persistent (shows a close button). */
  durationMs?: number;
  /** Extra space above the safe-area bottom (sticky action bar / tab bar). Falls back to the provider default. */
  bottomOffset?: number;
}

export interface ToastApi {
  show(options: ToastOptions): string;
  dismiss(id?: string): void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (api === null) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}

interface ActiveToast {
  id: string;
  options: ToastOptions;
  /** False while the exit animation runs. */
  open: boolean;
}

const TONE_GLYPH: Record<ToastTone, { glyph: GlyphName; color: AnyColorName }> = {
  success: { glyph: 'check', color: 'primaryText' },
  error: { glyph: 'exclamation', color: 'destructive' },
  info: { glyph: 'info', color: 'infoText' },
};

export interface ToastProviderProps {
  children: ReactNode;
  /** Default `bottomOffset` for every toast (WP4 passes the tab-bar height). */
  bottomOffset?: number;
}

export function ToastProvider({ children, bottomOffset = 0 }: ToastProviderProps) {
  const [active, setActive] = useState<ActiveToast | null>(null);
  const reduceMotion = useReduceMotion(); // read once here so the first toast already knows
  const counter = useRef(0);
  const activeId = useRef<string | null>(null);

  const show = useCallback((options: ToastOptions) => {
    counter.current += 1;
    const id = `toast-${counter.current}`;
    activeId.current = id;
    setActive((current) => replaceToast(current, { id, options, open: true }));
    return id;
  }, []);

  const dismiss = useCallback((id?: string) => {
    if (id !== undefined && id !== activeId.current) return;
    setActive((current) => (current !== null && current.open ? { ...current, open: false } : current));
  }, []);

  const onExited = useCallback((id: string) => {
    setActive((current) => (current !== null && current.id === id && !current.open ? null : current));
  }, []);

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {active !== null ? (
        <ToastView key={active.id} toast={active} defaultBottomOffset={bottomOffset} reduceMotion={reduceMotion} onDismiss={dismiss} onExited={onExited} />
      ) : null}
    </ToastContext.Provider>
  );
}

interface ToastViewProps {
  toast: ActiveToast;
  defaultBottomOffset: number;
  reduceMotion: boolean;
  onDismiss: (id: string) => void;
  onExited: (id: string) => void;
}

function ToastView({ toast, defaultBottomOffset, reduceMotion, onDismiss, onExited }: ToastViewProps) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const { id, options, open } = toast;
  const tone = options.tone ?? 'success';
  const hasAction = options.action !== undefined;
  const baseMs = baseToastDuration({ tone, hasAction, durationMs: options.durationMs });
  const persistent = isPersistent(baseMs);
  const progress = useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = shown
  const motionRef = useRef(toastDurations(reduceMotion));
  motionRef.current = toastDurations(reduceMotion);
  const message = options.message;

  // Enter + announce once per toast (the view is keyed by id, so `message` is fixed for its lifetime).
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
    const enter = motionRef.current.enter;
    if (enter === 0) {
      progress.setValue(1);
      return;
    }
    const run = Animated.timing(progress, { toValue: 1, duration: enter, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [progress, message]);

  // Auto-dismiss timer; cleared on unmount / replacement. Touches never cancel it.
  useEffect(() => {
    if (persistent) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = (ms: number) => {
      if (!cancelled) timer = setTimeout(() => onDismiss(id), ms);
    };
    AccessibilityInfo.isScreenReaderEnabled()
      .then(async (screenReader) => {
        if (cancelled) return;
        if (!screenReader) return arm(baseMs);
        let recommendedMs: number | undefined;
        if (Platform.OS === 'android' && typeof AccessibilityInfo.getRecommendedTimeoutMillis === 'function') {
          try {
            recommendedMs = await AccessibilityInfo.getRecommendedTimeoutMillis(baseMs);
          } catch {
            recommendedMs = undefined;
          }
        }
        arm(effectiveToastDuration(baseMs, { screenReader: true, recommendedMs }));
      })
      .catch(() => arm(baseMs));
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [id, baseMs, persistent, onDismiss]);

  // Exit (opacity only), then unmount.
  useEffect(() => {
    if (open) return;
    const exit = motionRef.current.exit;
    if (exit === 0) {
      progress.setValue(0);
      onExited(id);
      return;
    }
    const run = Animated.timing(progress, { toValue: 0, duration: exit, easing: Easing.in(Easing.ease), useNativeDriver: true });
    run.start(({ finished }) => {
      if (finished) onExited(id);
    });
    return () => run.stop();
  }, [open, id, progress, onExited]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [TOAST_ENTER_OFFSET, 0] });
  const look = TONE_GLYPH[tone];
  const bottom = toastBottom(insets.bottom, options.bottomOffset ?? defaultBottomOffset);

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom }} testID="toast-host">
      <Animated.View
        testID="toast"
        accessible={false}
        accessibilityRole={tone === 'error' ? 'alert' : undefined}
        accessibilityLiveRegion={toastLiveRegion(tone)}
        style={{
          opacity: progress,
          transform: [{ translateY }],
          minHeight: 56,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          backgroundColor: colors.popover,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: radius.lg,
          shadowColor,
          ...elevation.overlay,
        }}
      >
        <Glyph name={look.glyph} size={20} color={look.color} testID="toast-glyph" />
        <View style={{ flex: 1 }}>
          <Text role="body" color="popoverForeground">
            {message}
          </Text>
        </View>
        {options.action ? (
          <Button
            testID="toast-action"
            label={options.action.label}
            variant="ghost"
            size="md"
            fullWidth={false}
            onPress={() => {
              options.action?.onPress();
              onDismiss(id);
            }}
          />
        ) : null}
        {persistent ? (
          <IconButton testID="toast-close" icon="close" variant="ghost" accessibilityLabel={t('toast.dismiss')} onPress={() => onDismiss(id)} />
        ) : null}
      </Animated.View>
    </View>
  );
}
