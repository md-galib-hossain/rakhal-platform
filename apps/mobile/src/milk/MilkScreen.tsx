/**
 * Milk log screen (WP10, ADR-006, UI/UX overhaul).
 *
 * Screen access is gated by `milk.read`; logging milk and submitting sessions is gated by `milk.log`.
 * Offline writes are queued via `useSync().enqueue` and synchronized when connected.
 *
 * UI/UX Improvements:
 * 1. Date header opening DatePickerSheet with missing-entry red dots and Today shortcut.
 * 2. Session configuration allowing farms to lock unneeded milking sessions.
 * 3. Tank routing indicator and selector reading from offline cached milkTanks.
 * 4. Reactive live total collected summary with sellable/withholding breakdown.
 * 5. Ergonomic quick-input cow cards with direct decimal entry and +0.5 / +1.0 / +5.0 chips.
 * 6. Docked bottom bar with Save Draft and Submit actions.
 * 7. ADR-007 compliant: strictly zero drop shadows.
 */
import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Button } from '../components/actions/Button.tsx';
import { IconButton } from '../components/actions/IconButton.tsx';
import { EmptyState } from '../components/feedback/StateMessage.tsx';
import { Chip, ChipGroup } from '../components/forms/Chip.tsx';
import { TextField } from '../components/forms/TextField.tsx';
import { Glyph } from '../components/internal/Glyph.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { DatePickerSheet } from '../components/picker/DatePickerSheet.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useFormat } from '../i18n/useFormat.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { can } from '../permissions/can.ts';
import { PermissionGate } from '../permissions/PermissionGate.tsx';
import { MilkCowCard } from './MilkCowCard.tsx';
import {
  DEFAULT_SESSIONS,
  SESSION_ACCENTS,
  SESSION_LABEL_KEYS,
  toIsoDateString,
  type MilkCowRow,
} from './milk-model.ts';
import { SessionConfigSheet } from './SessionConfigSheet.tsx';
import { TankSelectorSheet } from './TankSelectorSheet.tsx';
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
    updateConfiguredSessions,
    sheds,
    selectedShedId,
    setSelectedShedId,
    search,
    setSearch,
    rows,
    liveTotals,
    tanks,
    selectedTankId,
    setSelectedTankId,
    calendarDays,
    isSessionSubmitted,
    isSubmitting,
    updateYield,
    saveAllDrafts,
    submitSession,
  } = useMilkScreen();

  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [sessionConfigVisible, setSessionConfigVisible] = useState(false);
  const [tankPickerVisible, setTankPickerVisible] = useState(false);

  const isToday = date === toIsoDateString();
  const activeTank = tanks.find((t) => t.id === selectedTankId) ?? tanks[0];
  const lockedSessions = DEFAULT_SESSIONS.filter((s) => !configuredSessions.includes(s));

  return (
    <KeyboardAvoidingView
      testID="screen-milk"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {/* Top Controls Area */}
      <View style={{ paddingHorizontal: tokens.spacing.md, paddingTop: tokens.spacing.md, gap: tokens.spacing.sm }}>
        {/* Date Row & Tank Routing Indicator */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacing.sm }}>
          {/* Interactive Date Pill with Nav Arrows */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
            <Button
              label="<"
              variant="ghost"
              size="md"
              onPress={() => changeDay(-1)}
              testID="milk-prev-day"
            />

            <PressableSurface
              accessibilityRole="button"
              accessibilityLabel={`${t('picker.singleDate')}: ${date}`}
              pressedStyle="overlay"
              onPress={() => setDatePickerVisible(true)}
              testID="milk-date-pill"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: tokens.spacing.xs,
                paddingHorizontal: tokens.spacing.sm,
                paddingVertical: tokens.spacing.xs,
                borderRadius: tokens.radius.full,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                minHeight: tokens.touchTarget.min,
              }}
            >
              <Glyph name="dot" size={16} color="primary" />
              <Text role="title" color="foreground" testID="milk-current-date">
                {date}
              </Text>
            </PressableSurface>

            <Button
              label=">"
              variant="ghost"
              size="md"
              onPress={() => changeDay(1)}
              testID="milk-next-day"
            />
          </View>

          {/* Quick Shortcuts: Today & Tank Selector */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
            {!isToday ? (
              <Button
                label={t('picker.today')}
                variant="secondary"
                size="md"
                onPress={() => setDate(toIsoDateString())}
                testID="milk-today-btn"
              />
            ) : null}

            {/* Destination Tank Chip */}
            <PressableSurface
              accessibilityRole="button"
              accessibilityLabel={`${t('milk.tank')}: ${activeTank ? activeTank.name : t('milk.tankSellable')}`}
              pressedStyle="overlay"
              onPress={() => setTankPickerVisible(true)}
              testID="milk-tank-chip"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: tokens.spacing.xs,
                paddingHorizontal: tokens.spacing.sm,
                paddingVertical: tokens.spacing.xs,
                borderRadius: tokens.radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                minHeight: tokens.touchTarget.min,
              }}
            >
              <Glyph name="check" size={16} color="primary" />
              <Text role="caption" color="foreground" style={{ fontWeight: '600' }}>
                {activeTank ? activeTank.name : t('milk.tankSellable')}
              </Text>
            </PressableSurface>
          </View>
        </View>

        {/* Session Chips & Session Management */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacing.xs }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: tokens.spacing.xs, alignItems: 'center' }}
          >
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

            {/* Locked Sessions display as disabled/locked indicator */}
            {lockedSessions.map((ls) => (
              <PressableSurface
                key={ls}
                accessibilityRole="button"
                accessibilityLabel={`${t(SESSION_LABEL_KEYS[ls])} ${t('milk.sessionLocked')}`}
                pressedStyle="overlay"
                onPress={() => setSessionConfigVisible(true)}
                testID={`session-locked-${ls.toLowerCase()}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: tokens.spacing.sm,
                  paddingVertical: tokens.spacing.xs,
                  borderRadius: tokens.radius.full,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.muted,
                  minHeight: tokens.touchTarget.min,
                  opacity: 0.65,
                }}
              >
                <Text role="caption" color="mutedForeground">
                  {t(SESSION_LABEL_KEYS[ls])} 🔒
                </Text>
              </PressableSurface>
            ))}
          </ScrollView>

          {/* Manage Sessions Button */}
          <IconButton
            icon="info"
            accessibilityLabel={t('milk.manageSessions')}
            variant="ghost"
            size="md"
            onPress={() => setSessionConfigVisible(true)}
            testID="milk-manage-sessions"
          />
        </View>

        {/* Shed Filter Chips */}
        {sheds.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: tokens.spacing.xs }}>
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
              gap: tokens.spacing.xs,
              padding: tokens.spacing.sm,
              borderRadius: tokens.radius.md,
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
              gap: tokens.spacing.xs,
              padding: tokens.spacing.sm,
              borderRadius: tokens.radius.md,
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
        ItemSeparatorComponent={() => <View style={{ height: tokens.spacing.sm }} />}
        contentContainerStyle={{
          padding: tokens.spacing.md,
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

      {/* Sticky Bottom Summary & Action Bar */}
      <View
        testID="milk-footer-bar"
        style={{
          borderTopWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          paddingHorizontal: tokens.spacing.md,
          paddingVertical: tokens.spacing.sm,
          gap: tokens.spacing.xs,
        }}
      >
        {/* Live Total and Breakdown Counter */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ gap: 2 }}>
            <Text role="label" color="foreground" testID="milk-total-summary">
              {t('milk.summary', {
                count: format.numberSafe(liveTotals.loggedCount),
                total: format.numberSafe(liveTotals.totalL),
              })}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
              <Text role="caption" color="mutedForeground">
                {t('milk.liveSellable', {
                  litres: format.numberSafe(liveTotals.sellableL, { fractionDigits: 1 }),
                })}
              </Text>
              {liveTotals.withheldL > 0 ? (
                <>
                  <Text role="caption" color="mutedForeground">·</Text>
                  <Text role="caption" color="destructive">
                    {t('milk.liveWithheld', {
                      litres: format.numberSafe(liveTotals.withheldL, { fractionDigits: 1 }),
                    })}
                  </Text>
                </>
              ) : null}
            </View>
          </View>

          {/* Action Buttons: Save Draft & Submit */}
          {canLog ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
              <Button
                label={t('milk.saveDraft')}
                variant="secondary"
                size="md"
                disabled={isSessionSubmitted || liveTotals.loggedCount === 0}
                onPress={() => void saveAllDrafts()}
                testID="milk-save-draft-btn"
              />
              <Button
                label={isSessionSubmitted ? t('milk.submitted') : t('milk.submit')}
                variant="primary"
                size="md"
                loading={isSubmitting}
                disabled={isSessionSubmitted || rows.length === 0}
                onPress={() => void submitSession()}
                testID="milk-submit-btn"
              />
            </View>
          ) : null}
        </View>
      </View>

      {/* Date Picker Sheet with Missing Status Red Dots */}
      <DatePickerSheet
        visible={datePickerVisible}
        onClose={() => setDatePickerVisible(false)}
        mode="single"
        value={date}
        days={calendarDays}
        onConfirmSingle={(d) => {
          if (d) setDate(d);
        }}
        testID="milk-date-picker-sheet"
      />

      {/* Session Configuration Sheet */}
      <SessionConfigSheet
        visible={sessionConfigVisible}
        onClose={() => setSessionConfigVisible(false)}
        configuredSessions={configuredSessions}
        onSave={updateConfiguredSessions}
        testID="milk-session-config-sheet"
      />

      {/* Tank Selector Sheet */}
      <TankSelectorSheet
        visible={tankPickerVisible}
        onClose={() => setTankPickerVisible(false)}
        tanks={tanks}
        selectedTankId={selectedTankId}
        onSelectTank={setSelectedTankId}
        testID="milk-tank-sheet"
      />
    </KeyboardAvoidingView>
  );
}

export function MilkScreen() {
  return (
    <PermissionGate permission="milk.read">
      <MilkScreenContent />
    </PermissionGate>
  );
}
