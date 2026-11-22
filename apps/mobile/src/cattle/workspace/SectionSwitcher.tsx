/**
 * SectionSwitcher: Horizontal scrollable tab bar for the 5 workspace sections.
 * (Overview, Timeline, Feeding, Family, Money).
 * 48dp touch target height, active bottom bar indicator, zero drop shadows.
 */
import { ScrollView, View } from 'react-native';
import { PressableSurface } from '../../components/internal/PressableSurface.tsx';
import { Text } from '../../components/primitives/Text.tsx';
import { useLocale } from '../../providers/LocaleProvider.tsx';
import { useTheme } from '../../providers/ThemeProvider.tsx';

export type WorkspaceSectionKey = 'overview' | 'timeline' | 'feeding' | 'family' | 'money';

export interface SectionSwitcherProps {
  currentSection: WorkspaceSectionKey;
  onSelectSection: (section: WorkspaceSectionKey) => void;
  canSeeMoney?: boolean;
  testID?: string;
}

const SECTIONS: WorkspaceSectionKey[] = ['overview', 'timeline', 'feeding', 'family', 'money'];

export function SectionSwitcher({
  currentSection,
  onSelectSection,
  canSeeMoney = true,
  testID = 'section-switcher',
}: SectionSwitcherProps) {
  const { colors } = useTheme();
  const { t } = useLocale();

  const visibleSections = SECTIONS.filter((s) => s !== 'money' || canSeeMoney);

  return (
    <View
      testID={testID}
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.border,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.card,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {visibleSections.map((section) => {
          const isActive = currentSection === section;
          return (
            <PressableSurface
              key={section}
              testID={`switcher-tab-${section}`}
              accessibilityRole="tab"
              pressedStyle="overlay"
              onPress={() => onSelectSection(section)}
              style={{
                minHeight: 48,
                paddingHorizontal: 12,
                justifyContent: 'center',
                alignItems: 'center',
                borderBottomWidth: isActive ? 2 : 0,
                borderBottomColor: colors.primary,
                marginBottom: -1,
              }}
            >
              <Text
                role="body"
                style={{
                  fontWeight: isActive ? '700' : '500',
                  color: isActive ? colors.foreground : colors.mutedForeground,
                }}
              >
                {t(`cattle.workspace.tabs.${section}`)}
              </Text>
            </PressableSurface>
          );
        })}
      </ScrollView>
    </View>
  );
}
