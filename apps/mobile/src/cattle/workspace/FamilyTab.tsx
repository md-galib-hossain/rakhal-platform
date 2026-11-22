/**
 * FamilyTab: Tab 4 of the Animal Workspace.
 * Renders:
 * 1. Parents section: Dam (Mother) and Sire (Father) cards (tappable if on farm)
 * 2. Offspring section: Calves born to this cow
 * 3. Siblings and Lineage pedigree cards
 * Strictly zero drop shadows (ADR-007 compliant).
 */
import { View } from 'react-native';
import { Card } from '../../components/display/Card.tsx';
import { PressableSurface } from '../../components/internal/PressableSurface.tsx';
import { Text } from '../../components/primitives/Text.tsx';
import type { MessageKey } from '../../i18n/messages.ts';
import { useFormat } from '../../i18n/useFormat.ts';
import { useLocale } from '../../providers/LocaleProvider.tsx';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import { radius, type ColorTokens } from '../../theme/tokens.ts';
import type { CattleDetail, PedigreeNode } from '../cattle-detail-model.ts';
import { BabyIcon, DnaIcon, UsersIcon } from '../CattleIcons.tsx';
import { AncestryTreeView } from './AncestryTreeView.tsx';

export interface FamilyTabProps {
  detail: CattleDetail;
  onNavigateToAnimal?: (id: string) => void;
  onInnerScrollActiveChange?: (active: boolean) => void;
  testID?: string;
}

export function FamilyTab({
  detail,
  onNavigateToAnimal,
  onInnerScrollActiveChange,
  testID = 'tab-family',
}: FamilyTabProps) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const format = useFormat();

  const pedigree = detail.pedigree;
  const dam = pedigree?.dam;
  const sire = pedigree?.sire;
  const offspring = pedigree?.offspring ?? [];
  const siblings = pedigree?.siblings ?? [];

  return (
    <View testID={testID} style={{ gap: 20, paddingHorizontal: 16, paddingVertical: 12 }}>
      {/* 1. Interactive Ancestry Tree Canvas */}
      <AncestryTreeView
        pedigree={pedigree}
        onNavigateToAnimal={onNavigateToAnimal}
        onInnerScrollActiveChange={onInnerScrollActiveChange}
        testID="family-ancestry-tree"
      />

      {/* 2. Parents Section */}
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <UsersIcon size={18} color={colors.foreground} />
          <Text role="title" style={{ fontWeight: '700' }}>
            {t('cattle.workspace.family.parents')}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          {renderParentCard({
            role: t('cattle.workspace.family.dam'),
            node: dam,
            colors,
            t,
            onPress: dam?.id && onNavigateToAnimal ? () => onNavigateToAnimal(dam.id!) : undefined,
            testID: 'parent-dam-card',
          })}
          {renderParentCard({
            role: t('cattle.workspace.family.sire'),
            node: sire,
            colors,
            t,
            onPress: sire?.id && onNavigateToAnimal ? () => onNavigateToAnimal(sire.id!) : undefined,
            testID: 'parent-sire-card',
          })}
        </View>
      </View>

      {/* 2. Siblings Section (if any) */}
      {siblings.length > 0 ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <DnaIcon size={18} color={colors.accentPurple} />
            <Text role="title" style={{ fontWeight: '700' }}>
              {t('cattle.workspace.family.siblings')} ({format.numberSafe(siblings.length)})
            </Text>
          </View>
          <View style={{ gap: 8 }}>
            {siblings.map((sib, i) => (
              <Card key={sib.id ?? `sib-${i}`}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text role="body" style={{ fontWeight: '600' }}>
                      {sib.name || sib.tag || '—'}
                    </Text>
                    {sib.tag && sib.name ? (
                      <Text role="caption" style={{ color: colors.mutedForeground }}>
                        {sib.tag}
                      </Text>
                    ) : null}
                  </View>
                  {sib.id && onNavigateToAnimal ? (
                    <PressableSurface
                      accessibilityRole="button"
                      pressedStyle="overlay"
                      onPress={() => onNavigateToAnimal(sib.id!)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: radius.md,
                        backgroundColor: colors.muted,
                        minHeight: 48,
                        justifyContent: 'center',
                      }}
                    >
                      <Text role="caption" style={{ fontWeight: '600' }}>
                        {t('cattle.workspace.family.viewAnimal')}
                      </Text>
                    </PressableSurface>
                  ) : null}
                </View>
              </Card>
            ))}
          </View>
        </View>
      ) : null}

      {/* 3. Offspring Section */}
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <BabyIcon size={18} color={colors.info} />
          <Text role="title" style={{ fontWeight: '700' }}>
            {t('cattle.workspace.family.offspring')} ({format.numberSafe(offspring.length)})
          </Text>
        </View>

        {offspring.length === 0 ? (
          <Card>
            <View style={{ minHeight: 100, justifyContent: 'center', alignItems: 'center', gap: 6 }}>
              <BabyIcon size={24} color={colors.mutedForeground} />
              <Text role="body" style={{ color: colors.mutedForeground }}>
                {t('cattle.workspace.family.noOffspring')}
              </Text>
            </View>
          </Card>
        ) : (
          <View style={{ gap: 8 }}>
            {offspring.map((calf) => (
              <Card key={calf.id} testID={`offspring-card-${calf.id}`}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ gap: 2 }}>
                    <Text role="body" style={{ fontWeight: '700' }}>
                      {calf.name || calf.tag}
                    </Text>
                    <Text role="caption" style={{ color: colors.mutedForeground }}>
                      {calf.tag} · {calf.birth_date ? format.dateSafe(Date.parse(calf.birth_date)) : ''}
                    </Text>
                  </View>
                  {calf.id && onNavigateToAnimal ? (
                    <PressableSurface
                      accessibilityRole="button"
                      pressedStyle="overlay"
                      onPress={() => onNavigateToAnimal(calf.id)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: radius.md,
                        backgroundColor: colors.muted,
                        minHeight: 48,
                        justifyContent: 'center',
                      }}
                    >
                      <Text role="caption" style={{ fontWeight: '600' }}>
                        {t('cattle.workspace.family.viewAnimal')}
                      </Text>
                    </PressableSurface>
                  ) : null}
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function renderParentCard({
  role,
  node,
  colors,
  t,
  onPress,
  testID,
}: {
  role: string;
  node: PedigreeNode | null | undefined;
  colors: ColorTokens;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  onPress?: () => void;
  testID?: string;
}) {
  const isPresent = Boolean(node && (node.id || node.name || node.tag));

  const content = (
    <View style={{ gap: 4 }}>
      <Text role="caption" style={{ color: colors.mutedForeground, fontWeight: '600' }}>
        {role}
      </Text>
      {isPresent ? (
        <>
          <Text role="body" style={{ fontWeight: '700' }} numberOfLines={1}>
            {node?.name || node?.tag || '—'}
          </Text>
          {node?.tag && node.name ? (
            <Text role="caption" style={{ color: colors.mutedForeground }} numberOfLines={1}>
              {node.tag}
            </Text>
          ) : null}
        </>
      ) : (
        <Text role="caption" style={{ color: colors.mutedForeground }}>
          {t('cattle.workspace.family.unknown')}
        </Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <PressableSurface
        testID={testID}
        accessibilityRole="button"
        pressedStyle="overlay"
        onPress={onPress}
        style={{
          flex: 1,
          padding: 14,
          borderRadius: radius.lg,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          minHeight: 88,
          justifyContent: 'center',
        }}
      >
        {content}
      </PressableSurface>
    );
  }

  return (
    <View
      testID={testID}
      style={{
        flex: 1,
        padding: 14,
        borderRadius: radius.lg,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        minHeight: 88,
        justifyContent: 'center',
      }}
    >
      {content}
    </View>
  );
}
