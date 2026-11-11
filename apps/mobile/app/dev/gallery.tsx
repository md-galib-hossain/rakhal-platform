/**
 * Dev-only design gallery (spec W2-8). Raw RN View/Pressable styled by tokens only (shared controls live in src/dev/GalleryControls.tsx);
 * the WP3 component matrix is the sibling route components.tsx. Outside __DEV__ this route redirects home so it can never ship as a reachable screen.
 */
import { runGoldenVectors, type GoldenResult } from '@rakhal/domain';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heading, Text } from '../../src/components/primitives/Text.tsx';
import { TextScaleProvider } from '../../src/components/primitives/TextScaleContext.tsx';
import { Button } from '../../src/components/actions/Button.tsx';
import { FontScaleChoice, LocaleChoice, Section, ThemeChoice } from '../../src/dev/GalleryControls.tsx';
import { messages } from '../../src/i18n/messages.ts';
import { useFormat } from '../../src/i18n/useFormat.ts';
import { useLocale } from '../../src/providers/LocaleProvider.tsx';
import { useTheme } from '../../src/providers/ThemeProvider.tsx';
import { typeScale, type AnyColorName, type TextRole } from '../../src/theme/tokens.ts';

export default function GalleryRoute() {
  // Checked at render time (not module load) so tests can flip __DEV__.
  if (!__DEV__) return <Redirect href="/" />;
  return <Gallery />;
}

const SWATCHES: readonly AnyColorName[] = [
  'background',
  'foreground',
  'card',
  'primary',
  'primaryForeground',
  'secondary',
  'muted',
  'mutedForeground',
  'border',
  'inputBorder',
  'focusRing',
  'success',
  'warning',
  'destructive',
  'info',
];

const ROLES = Object.keys(typeScale) as TextRole[];
function ActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        minHeight: tokens.touchTarget.min,
        justifyContent: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: tokens.spacing.lg,
        borderRadius: tokens.radius.md,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        backgroundColor: colors.secondary,
      }}
    >
      <Text role="button">{label}</Text>
    </Pressable>
  );
}

function intlProbe(): string[] {
  const probe = (tag: string): string => {
    try {
      return `${tag}: ${new Intl.NumberFormat(tag).format(1250000)}`;
    } catch (error) {
      return `${tag}: unavailable (${error instanceof Error ? error.message : String(error)})`;
    }
  };
  return ['en-IN', 'bn-BD', 'bn-BD-u-nu-latn'].map(probe);
}

function Gallery() {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  const format = useFormat();
  const insets = useSafeAreaInsets();
  const [scale, setScale] = useState<number | null>(null);
  const [selfTest, setSelfTest] = useState<GoldenResult | null>(null);
  const [probe, setProbe] = useState<string[] | null>(null);

  const sampleDate = new Date(Date.UTC(2026, 10, 11, 6, 0, 0));
  const page = (
    <ScrollView
      testID="gallery-scroll"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + tokens.spacing.lg,
        paddingBottom: insets.bottom + tokens.spacing.lg,
        paddingLeft: insets.left + tokens.spacing.lg,
        paddingRight: insets.right + tokens.spacing.lg,
        gap: tokens.spacing.lg,
      }}
    >
      <Heading>{t('gallery.title')}</Heading>
      {/* Link to the WP3 component matrix (dev only; this whole route is __DEV__-gated). */}
      <Button label="Components" variant="secondary" onPress={() => router.push('/dev/components')} />

      <Section title={t('gallery.theme')}>
        <ThemeChoice />
        <View style={{ gap: tokens.spacing.sm }}>
          {SWATCHES.map((name) => (
            <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md }}>
              <View
                style={{
                  width: tokens.touchTarget.min / 2,
                  height: tokens.touchTarget.min / 2,
                  borderRadius: tokens.radius.sm,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors[name],
                }}
              />
              <View style={{ flex: 1 }}>
                <Text role="label">{name}</Text>
                <Text role="caption" color="mutedForeground">
                  {colors[name]}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Section>

      <Section title={`${t('gallery.language')} / ${t('gallery.digits')}`}>
        <LocaleChoice />
      </Section>

      <Section title={t('gallery.typography')}>
        {ROLES.map((role) => (
          <View key={role} style={{ gap: tokens.spacing.xs }}>
            <Text role="caption" color="mutedForeground">
              {role}
            </Text>
            <Text role={role}>{messages.en['gallery.sample.conjunct']}</Text>
            <Text role={role}>{messages.bn['gallery.sample.conjunct']}</Text>
          </View>
        ))}
        <Text>{messages.bn['gallery.sample.long']}</Text>
        <Text>{messages.en['gallery.sample.long']}</Text>
      </Section>

      <Section title={t('gallery.formats')}>
        <Text>{format.money(1250000)}</Text>
        <Text>{format.money(100000)}</Text>
        <Text>{format.money(-1234567)}</Text>
        <Text>{format.number(1234567.891, { fractionDigits: 3 })}</Text>
        <Text>{format.date(sampleDate)}</Text>
        <Text>{format.date(sampleDate, 'long')}</Text>
        <Text>{format.time(sampleDate)}</Text>
        <Text>{t('gallery.herdCount', { count: format.number(42) })}</Text>
      </Section>

      <Section title={t('gallery.fontScale')}>
        <FontScaleChoice scale={scale} onScaleChange={setScale} />
      </Section>

      <Section title="Formatter self-test">
        <ActionButton label="Run golden vectors" onPress={() => setSelfTest(runGoldenVectors())} />
        {selfTest === null ? null : (
          <View style={{ gap: tokens.spacing.xs }}>
            <Text color={selfTest.failures.length === 0 ? 'success' : 'destructive'}>
              {`${selfTest.passed} / ${selfTest.total} passed`}
            </Text>
            {selfTest.failures.slice(0, 5).map((failure, index) => (
              <Text key={index} role="caption">
                {`${failure.vector.fn}(${JSON.stringify(failure.vector.args)}) = ${failure.actual}, expected ${failure.vector.expected}`}
              </Text>
            ))}
          </View>
        )}
      </Section>

      <Section title="Intl probe">
        <ActionButton label="Run Intl probe" onPress={() => setProbe(intlProbe())} />
        {probe?.map((line) => (
          <Text key={line} role="caption">
            {line}
          </Text>
        ))}
      </Section>
    </ScrollView>
  );

  return scale === null ? page : <TextScaleProvider scale={scale}>{page}</TextScaleProvider>;
}
