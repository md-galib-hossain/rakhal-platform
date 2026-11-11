/**
 * Shared dev-gallery controls (theme, language/digits, font scale), moved out of app/dev/gallery.tsx without
 * behaviour change so app/dev/gallery.tsx and app/dev/components.tsx use the same switches. Dev-only; never import
 * from product screens. Raw Pressable styled by tokens (the gallery must stay usable if a WP3 component is broken).
 */
import type { DigitSystem, Locale } from '@rakhal/domain';
import { PixelRatio, Pressable, View } from 'react-native';
import type { ReactNode } from 'react';
import { Heading, Text } from '../components/primitives/Text.tsx';
import type { MessageKey } from '../i18n/messages.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import type { ThemePref } from '../theme/theme-pref.ts';

export const THEME_PREFS: readonly ThemePref[] = ['system', 'light', 'dark'];
export const LOCALES: readonly Locale[] = ['bn', 'en'];
export const DIGIT_SYSTEMS: readonly DigitSystem[] = ['latn', 'beng'];
/** null = follow the system scale (no override). */
export const SCALES: readonly (number | null)[] = [null, 1.0, 1.3, 2.0];

export interface Option<T> {
  value: T;
  label: string;
}

export function Choice<T extends string | number | null>({
  options,
  selected,
  onSelect,
}: {
  options: readonly Option<T>[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  const { colors, tokens } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm }}>
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(option.value)}
            style={{
              minHeight: tokens.touchTarget.min,
              justifyContent: 'center',
              paddingHorizontal: tokens.spacing.lg,
              borderRadius: tokens.radius.md,
              borderWidth: 1,
              borderColor: isSelected ? colors.primaryEdge : colors.inputBorder,
              backgroundColor: isSelected ? colors.primary : colors.card,
            }}
          >
            <Text role="button" color={isSelected ? 'primaryForeground' : 'foreground'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors, tokens } = useTheme();
  return (
    <View
      style={{
        gap: tokens.spacing.md,
        padding: tokens.spacing.lg,
        borderRadius: tokens.radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      }}
    >
      <Heading role="h2">{title}</Heading>
      {children}
    </View>
  );
}

/** Theme preference choice (system / light / dark). */
export function ThemeChoice() {
  const { preference, setPreference } = useTheme();
  const { t } = useLocale();
  return (
    <Choice
      options={THEME_PREFS.map((value) => ({ value, label: t(`theme.${value}` as MessageKey) }))}
      selected={preference}
      onSelect={setPreference}
    />
  );
}

/** Language + digit-system choices. */
export function LocaleChoice() {
  const { locale, digits, setLocale, setDigits, t } = useLocale();
  return (
    <>
      <Choice
        options={LOCALES.map((value) => ({ value, label: t(`language.${value}` as MessageKey) }))}
        selected={locale}
        onSelect={setLocale}
      />
      <Choice
        options={DIGIT_SYSTEMS.map((value) => ({ value, label: t(`digits.${value}` as MessageKey) }))}
        selected={digits}
        onSelect={setDigits}
      />
    </>
  );
}

/** Font-scale override choice plus the system scale read-out. The caller owns the state and wraps in TextScaleProvider. */
export function FontScaleChoice({
  scale,
  onScaleChange,
}: {
  scale: number | null;
  onScaleChange: (value: number | null) => void;
}) {
  const { t } = useLocale();
  return (
    <>
      <Choice
        options={SCALES.map((value) => ({
          value,
          label: value === null ? t('theme.system') : `${value.toFixed(1)}x`,
        }))}
        selected={scale}
        onSelect={onScaleChange}
      />
      <Text role="caption" color="mutedForeground">
        {`PixelRatio.getFontScale() = ${PixelRatio.getFontScale()}`}
      </Text>
    </>
  );
}
