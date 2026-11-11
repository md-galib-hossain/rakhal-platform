/**
 * SheetModal (spec 2.0): the internal bottom sheet ConfirmSheet is built on (promoted to a public BottomSheet in
 * Tranche B). RN core `Modal` (transparent, no native animation, translucent status + navigation bars); the
 * `onRequestClose` prop is the Android back button.
 *
 * - Backdrop: `shadowColor` at 50% (Pressable, hidden from a11y). Sheet: `popover` surface, top corners `radius.lg`,
 *   `elevation.overlay`, content padded `spacing.lg` with the bottom padded by the safe-area inset (see sheet-motion.ts).
 * - Motion (Animated, native driver, opacity + translateY only): backdrop fade 150ms, sheet slides in 220ms, out 160ms;
 *   under reduce motion every duration is 0 (instant). The Modal stays mounted until the exit finishes.
 * - While `dismissable` is false (busy) the backdrop tap and Android back are ignored.
 * - Focus: on open, screen-reader focus moves to the `SheetTitle` child (AccessibilityInfo.setAccessibilityFocus).
 * - Content scrolls when taller than 90% of the screen (200% font scale); do not rely on the sheet growing.
 *
 * SPIKE V-C2 (device): `useSafeAreaInsets()` inside an Android Modal and `navigationBarTranslucent` are implemented per
 * spec and NOT verified on a device; if the inset reads 0 the 16dp minimum in sheetBottomPadding still applies.
 * SPIKE V-C4: `Animated` native driver in Expo Go is likewise unverified (jest only).
 */
import {
  createContext,
  type ComponentRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  findNodeHandle,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import { elevation, radius, shadowColor, spacing } from '../../theme/tokens.ts';
import { Text } from '../primitives/Text.tsx';
import { useReduceMotion } from './useReduceMotion.ts';
import {
  SHEET_BACKDROP_OPACITY,
  SHEET_MAX_HEIGHT_FRACTION,
  dismissAllowed,
  sheetBottomPadding,
  sheetDurations,
} from './sheet-motion.ts';

/** Delay before moving screen-reader focus, so the Modal's content is attached to the native hierarchy first. */
export const SHEET_FOCUS_DELAY_MS = 100;

type ViewRef = ComponentRef<typeof View>;

const TitleRefContext = createContext<RefObject<ViewRef | null> | null>(null);

export interface SheetTitleProps {
  children: string;
}

/** The sheet's heading and the screen-reader focus target on open. Use exactly one per sheet. */
export function SheetTitle({ children }: SheetTitleProps) {
  const ref = useContext(TitleRefContext);
  return (
    <View ref={ref} accessible accessibilityRole="header" testID="sheet-title">
      <Text role="h2" color="popoverForeground">
        {children}
      </Text>
    </View>
  );
}

export interface SheetModalProps {
  visible: boolean;
  /** Back button / backdrop tap. Ignored while `dismissable` is false. */
  onRequestClose: () => void;
  /** Default true. Pass false while a confirm action is busy. */
  dismissable?: boolean;
  children: ReactNode;
  testID?: string;
}

export function SheetModal({ visible, onRequestClose, dismissable = true, children, testID }: SheetModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const titleRef = useRef<ViewRef | null>(null);

  const [mounted, setMounted] = useState(visible);
  const [sheetHeight, setSheetHeight] = useState(0);
  const wasShown = useRef(visible);
  const backdrop = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(visible ? 0 : 1)).current; // 0 = shown, 1 = fully below the screen

  useEffect(() => {
    const d = sheetDurations(reduceMotion);
    if (visible) {
      wasShown.current = true;
      setMounted(true);
      if (d.enter === 0 && d.backdrop === 0) {
        backdrop.setValue(SHEET_BACKDROP_OPACITY);
        slide.setValue(0);
        return;
      }
      const run = Animated.parallel([
        Animated.timing(backdrop, { toValue: SHEET_BACKDROP_OPACITY, duration: d.backdrop, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: d.enter, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]);
      run.start();
      return () => run.stop();
    }
    if (!wasShown.current) return; // never opened: nothing to animate out
    wasShown.current = false;
    if (d.exit === 0) {
      backdrop.setValue(0);
      slide.setValue(1);
      setMounted(false);
      return;
    }
    const run = Animated.parallel([
      Animated.timing(backdrop, { toValue: 0, duration: d.exit, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(slide, { toValue: 1, duration: d.exit, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]);
    run.start(({ finished }) => {
      if (finished) setMounted(false);
    });
    return () => run.stop();
  }, [visible, reduceMotion, backdrop, slide]);

  // Move screen-reader focus to the title once the sheet is open.
  useEffect(() => {
    if (!visible || !mounted) return;
    const timer = setTimeout(() => {
      const handle = titleRef.current ? findNodeHandle(titleRef.current) : null;
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    }, SHEET_FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [visible, mounted]);

  const close = useCallback(() => {
    if (dismissAllowed(dismissable)) onRequestClose();
  }, [dismissable, onRequestClose]);

  const onSheetLayout = (event: LayoutChangeEvent) => setSheetHeight(event.nativeEvent.layout.height);
  // Until measured, assume the sheet is a full screen tall so it can never flash on screen before sliding in.
  const travel = sheetHeight > 0 ? sheetHeight : windowHeight;
  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [0, travel] });

  return (
    <Modal
      testID={testID ?? 'sheet-modal'}
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: shadowColor, opacity: backdrop }]}
        />
        <Pressable
          testID="sheet-backdrop"
          accessible={false}
          importantForAccessibility="no"
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          testID="sheet-surface"
          accessibilityViewIsModal
          onLayout={onSheetLayout}
          style={{
            maxHeight: windowHeight * SHEET_MAX_HEIGHT_FRACTION,
            backgroundColor: colors.popover,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            shadowColor,
            ...elevation.overlay,
            transform: [{ translateY }],
          }}
        >
          <TitleRefContext.Provider value={titleRef}>
            <ScrollView
              testID="sheet-content"
              bounces={false}
              style={{ flexGrow: 0 }}
              contentContainerStyle={{
                paddingTop: spacing.lg,
                paddingHorizontal: spacing.lg,
                paddingBottom: sheetBottomPadding(insets.bottom),
                gap: spacing.md,
              }}
            >
              {children}
            </ScrollView>
          </TitleRefContext.Provider>
        </Animated.View>
      </View>
    </Modal>
  );
}
