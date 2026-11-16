/**
 * Milk log screen (WP10, ADR-006).
 *
 * Screen access is gated by `milk.read`; logging milk and submitting sessions is gated by `milk.log`.
 * Offline writes are queued via `useSync().enqueue` and synchronized when connected.
 */
import { FlatList, ScrollView, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Button } from '../components/actions/Button.tsx';
import { EmptyState } from '../components/feedback/StateMessage.tsx';
import { Chip, ChipGroup } from '../components/forms/Chip.tsx';
import { TextField } from '../components/forms/TextField.tsx';
import { Glyph } from '../components/internal/Glyph.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useFormat } from '../i18n/useFormat.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { can } from '../permissions/can.ts';
import { PermissionGate } from '../permissions/PermissionGate.tsx';
import { radius, spacing } from '../theme/tokens.ts';
import { MilkCowCard } from './MilkCowCard.tsx';
import {
  SESSION_ACCENTS,
  SESSION_LABEL_KEYS,
  toIsoDateString,
  type MilkCowRow,
} from './milk-model.ts';
import { useMilkScreen } from './useMilkScreen.ts';

export function MilkScreenContent() {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  const format = useFormat();
  const { permissions } = useAuth();
  const canLog = can(permissions, 'milk.log');

  const {
    date,
    setDate,
    changeDay,
    session,
    setSession,
    configuredSessions,
    sheds,
    selectedShedId,
    setSelectedShedId,
    search,
    setSearch,
    rows,
    totalLitres,
    loggedCowsCount,
    isSessionSubmitted,
    isSubmitting,
    updateYield,
    submitSession,
  } = useMilkScreen();

  const isToday = date === toIsoDateString();

  return (
    <View testID="screen-milk" style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Top Controls Area */}
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.sm }}>
        {/* Date Row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Button
              label="<"
              variant="ghost"
              size="md"
              onPress={() => changeDay(-1)}
              testID="milk-prev-day"
            />
            <Text role="title" color="foreground" testID="milk-current-date">
              {date}
            </Text>
            <Button
              label=">"
              variant="ghost"
              size="md"
              onPress={() => changeDay(1)}
              testID="milk-next-day"
            />
          </View>

          {!isToday ? (
            <Button
              label={t('common.ok')}
              variant="secondary"
              size="md"
              onPress={() => setDate(toIsoDateString())}
              testID="milk-today-btn"
            />
          ) : null}
        </View>

        {/* Session Chips */}
        <ChipGroup accessibilityLabel={t('milk.session.selector')}>
          {configuredSessions.map((s) => (
            <Chip
              key={s}
              label={t(SESSION_LABEL_KEYS[s])}
              selected={session === s}
              accentColor={SESSION_ACCENTS[s]}
              onPress={() => setSession(s)}
              testID={`session-chip-${s.toLowerCase()}`}
            />
          ))}
        </ChipGroup>

        {/* Shed Filter Chips */}
        {sheds.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
            <Chip
              label={t('milk.allSheds')}
              selected={selectedShedId === null}
              onPress={() => setSelectedShedId(null)}
              testID="shed-chip-all"
            />
            {sheds.map((shed) => (
              <Chip
                key={shed.id}
                label={shed.name}
                selected={selectedShedId === shed.id}
                onPress={() => setSelectedShedId(shed.id)}
                testID={`shed-chip-${shed.id}`}
              />
            ))}
          </ScrollView>
        ) : null}

        {/* Search Input */}
        <TextField
          label={t('milk.searchPlaceholder')}
          value={search}
          onChangeText={setSearch}
          placeholder={t('cattle.search.placeholder')}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          testID="milk-search"
        />

        {/* Notice if session was submitted */}
        {isSessionSubmitted ? (
          <View
            testID="milk-submitted-banner"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              padding: spacing.sm,
              borderRadius: radius.md,
              backgroundColor: colors.muted,
            }}
          >
            <Glyph name="info" size={16} color="infoText" />
            <Text role="caption" color="mutedForeground" style={{ flex: 1 }}>
              {t('milk.submittedOfflineNote')}
            </Text>
          </View>
        ) : null}

        {/* Notice if user lacks logging permission */}
        {!canLog ? (
          <View
            testID="milk-no-log-banner"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              padding: spacing.sm,
              borderRadius: radius.md,
              backgroundColor: colors.muted,
            }}
          >
            <Glyph name="exclamation" size={16} color="warningText" />
            <Text role="caption" color="mutedForeground" style={{ flex: 1 }}>
              {t('milk.logForbidden')}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Cow Cards List */}
      <FlatList<MilkCowRow>
        style={{ flex: 1 }}
        data={rows}
        keyExtractor={(item) => item.cattleId}
        renderItem={({ item }) => (
          <MilkCowCard
            row={item}
            disabled={!canLog || isSessionSubmitted}
            onChangeYield={updateYield}
            testID={`milk-cow-card-${item.cattleId}`}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: tokens.spacing.xxxl * 2,
        }}
        ListEmptyComponent={
          <EmptyState
            icon="info"
            title={t('milk.empty')}
            description=""
            testID="milk-empty"
          />
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />

      {/* Sticky Bottom Summary & Submit Bar */}
      <View
        testID="milk-footer-bar"
        style={{
          borderTopWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          minHeight: tokens.touchTarget.min,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text role="label" color="foreground" testID="milk-total-summary">
            {t('milk.summary', {
              count: format.numberSafe(loggedCowsCount),
              total: format.numberSafe(totalLitres),
            })}
          </Text>
        </View>

        {canLog ? (
          <Button
            label={isSessionSubmitted ? t('milk.submitted') : t('milk.submit')}
            variant="primary"
            size="md"
            fullWidth={false}
            loading={isSubmitting}
            disabled={isSessionSubmitted || rows.length === 0}
            onPress={() => void submitSession()}
            testID="milk-submit-btn"
          />
        ) : null}
      </View>
    </View>
  );
}

export function MilkScreen() {
  return (
    <PermissionGate permission="milk.read">
      <MilkScreenContent />
    </PermissionGate>
  );
}
