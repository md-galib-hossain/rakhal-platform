/**
 * Milk log screen (WP10, UI/UX overhaul).
 *
 * Screen access is gated by `milk.read`; logging milk and submitting sessions is gated by `milk.log`.
 * Offline writes are queued via `useSync().enqueue` and synchronized when connected.
 *
 * Modern UI/UX Improvements:
 * 1. Compact 2-row header:
 *    - Row 1: Single Date pill (opens DatePickerSheet with missed dots and Today jump) + Segmented session switch.
 *    - Row 2: Search bar with dedicated Filter button [ 🎚️ ] opening MilkFilterSheet.
 * 2. MilkFilterSheet:
 *    - Shed selection chips, Status chips (All / Milking / Withheld), Tank Routing chips, Apply Filter action.
 * 3. Streamlined Cow Milking Cards:
 *    - Direct decimal numeric input field without cluttering steppers or + / - chips.
 *    - Clean status badges (Milking / Withheld) with NO "! Waiting" badge visual noise.
 *    - Reference yields (Yesterday & 7d avg) and destination tank badge.
 * 4. Generous bottom padding (paddingBottom: 120) so the last card BD-0004 scrolls well above the footer.
 * 5. Sleek docked summary footer with live Total L, logged cow count, and clean Submit session button.
 * 6. ADR-007 compliant: strictly zero drop shadows, 1px border and token fills only.
 */
import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Button } from '../components/actions/Button.tsx';
import { IconButton } from '../components/actions/IconButton.tsx';
import { EmptyState } from '../components/feedback/StateMessage.tsx';
import { Glyph } from '../components/internal/Glyph.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { DatePickerSheet } from '../components/picker/DatePickerSheet.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useFormat } from '../i18n/useFormat.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { can } from '../permissions/can.ts';
import { PermissionGate } from '../permissions/PermissionGate.tsx';
import { CalendarIcon } from './CalendarIcon.tsx';
import { FilterIcon } from './FilterIcon.tsx';
import { MilkCowCard } from './MilkCowCard.tsx';
import { MilkFilterSheet } from './MilkFilterSheet.tsx';
import {
  DEFAULT_SESSIONS,
  SESSION_LABEL_KEYS,
  type MilkCowRow,
} from './milk-model.ts';
import { SearchIcon } from './SearchIcon.tsx';
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
    session,
    setSession,
    configuredSessions,
    updateConfiguredSessions,
    sheds,
    selectedShedId,
    setSelectedShedId,
    statusFilter,
    setStatusFilter,
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
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [sessionConfigVisible, setSessionConfigVisible] = useState(false);
  const [tankPickerVisible, setTankPickerVisible] = useState(false);

  const activeTank = tanks.find((t) => t.id === selectedTankId) ?? tanks[0];
  const lockedSessions = DEFAULT_SESSIONS.filter((s) => !configuredSessions.includes(s));
  const hasActiveFilters = selectedShedId !== null || statusFilter !== 'all' || selectedTankId !== null;

  // Format date display (e.g. 16 Nov 2026)
  const dateObj = new Date(`${date}T00:00:00`);
  const formattedDate = format.dateSafe(dateObj);

  return (
    <KeyboardAvoidingView
      testID="screen-milk"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {/* Compact Top Header (Row 1: Date & Session; Row 2: Search & Filter) */}
      <View
        style={{
          paddingHorizontal: tokens.spacing.md,
          paddingTop: tokens.spacing.sm,
          paddingBottom: tokens.spacing.xs,
          gap: tokens.spacing.xs,
          borderBottomWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        }}
      >
        {/* Row 1: Date Pill + Segmented Session Switch */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacing.xs }}>
          {/* Sleek Date Pill (Tapping opens calendar sheet with red dots & today jump) */}
          <PressableSurface
            accessibilityRole="button"
            accessibilityLabel={`${t('picker.singleDate')}: ${formattedDate}`}
            pressedStyle="overlay"
            onPress={() => setDatePickerVisible(true)}
            testID="milk-date-pill"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: tokens.spacing.sm,
              paddingVertical: tokens.spacing.xs,
              borderRadius: tokens.radius.full,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
              minHeight: tokens.touchTarget.min,
            }}
          >
            <CalendarIcon size={16} color={colors.primary} />
            <Text role="caption" color="foreground" style={{ fontWeight: '600' }} testID="milk-current-date">
              {formattedDate}
            </Text>
          </PressableSurface>

          {/* Segmented Session Pill Switch */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 4, alignItems: 'center' }}
            >
              {configuredSessions.map((s) => {
                const isSelected = session === s;
                return (
                  <PressableSurface
                    key={s}
                    accessibilityRole="button"
                    accessibilityLabel={t(SESSION_LABEL_KEYS[s])}
                    pressedStyle="overlay"
                    onPress={() => setSession(s)}
                    testID={`session-chip-${s.toLowerCase()}`}
                    style={{
                      paddingHorizontal: tokens.spacing.sm,
                      paddingVertical: tokens.spacing.xs,
                      borderRadius: tokens.radius.full,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? colors.primary : colors.background,
                      minHeight: tokens.touchTarget.min,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      role="caption"
                      color={isSelected ? 'primaryForeground' : 'foreground'}
                      style={{ fontWeight: isSelected ? '700' : '500' }}
                    >
                      {t(SESSION_LABEL_KEYS[s])}
                    </Text>
                  </PressableSurface>
                );
              })}

              {/* Locked Sessions displayed with padlock */}
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
                    gap: 3,
                    paddingHorizontal: tokens.spacing.xs + 2,
                    paddingVertical: tokens.spacing.xs,
                    borderRadius: tokens.radius.full,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.muted,
                    minHeight: tokens.touchTarget.min,
                    opacity: 0.65,
                  }}
                >
                  <Text role="caption" color="mutedForeground" style={{ fontSize: 11 }}>
                    {t(SESSION_LABEL_KEYS[ls])} 🔒
                  </Text>
                </PressableSurface>
              ))}
            </ScrollView>

            {/* Session Settings Trigger */}
            <IconButton
              icon="info"
              accessibilityLabel={t('milk.manageSessions')}
              variant="ghost"
              size="md"
              onPress={() => setSessionConfigVisible(true)}
              testID="milk-manage-sessions"
            />
          </View>
        </View>

        {/* Row 2: Search Bar + Filter Button [ 🎚️ ] */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: tokens.touchTarget.min,
              paddingHorizontal: tokens.spacing.sm,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.inputBorder,
              borderRadius: tokens.radius.md,
              gap: tokens.spacing.xs,
            }}
          >
            <SearchIcon size={18} color={colors.mutedForeground} />
            <TextInput
              testID="milk-search"
              value={search}
              onChangeText={setSearch}
              placeholder={t('cattle.search.placeholder')}
              placeholderTextColor={colors.mutedForeground}
              style={{
                flex: 1,
                color: colors.foreground,
                fontSize: 14,
                paddingVertical: Platform.OS === 'ios' ? 8 : 4,
              }}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 ? (
              <PressableSurface
                accessibilityRole="button"
                accessibilityLabel={t('picker.clear')}
                pressedStyle="overlay"
                onPress={() => setSearch('')}
                testID="milk-search-clear"
              >
                <Glyph name="close" size={16} color="mutedForeground" />
              </PressableSurface>
            ) : null}
          </View>

          {/* Filter button [ 🎚️ ] matching user mockup */}
          <PressableSurface
            accessibilityRole="button"
            accessibilityLabel={t('milk.filterTitle')}
            pressedStyle="overlay"
            onPress={() => setFilterSheetVisible(true)}
            testID="milk-filter-button"
            style={{
              width: tokens.touchTarget.min,
              height: tokens.touchTarget.min,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: hasActiveFilters ? colors.primary : colors.background,
              borderWidth: 1,
              borderColor: hasActiveFilters ? colors.primary : colors.inputBorder,
              borderRadius: tokens.radius.md,
            }}
          >
            <FilterIcon size={20} color={hasActiveFilters ? colors.primaryForeground : colors.foreground} />
          </PressableSurface>
        </View>

        {/* Notice if session was submitted */}
        {isSessionSubmitted ? (
          <View
            testID="milk-submitted-banner"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: tokens.spacing.xs,
              padding: tokens.spacing.xs,
              borderRadius: tokens.radius.sm,
              backgroundColor: colors.muted,
            }}
          >
            <Glyph name="info" size={16} color="infoText" />
            <Text role="caption" color="mutedForeground" style={{ flex: 1, fontSize: 11 }}>
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
              padding: tokens.spacing.xs,
              borderRadius: tokens.radius.sm,
              backgroundColor: colors.muted,
            }}
          >
            <Glyph name="exclamation" size={16} color="warningText" />
            <Text role="caption" color="mutedForeground" style={{ flex: 1, fontSize: 11 }}>
              {t('milk.logForbidden')}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Cow Cards List with 120dp bottom padding so BD-0004 scrolls well above the footer */}
      <FlatList<MilkCowRow>
        style={{ flex: 1 }}
        data={rows}
        keyExtractor={(item) => item.cattleId}
        renderItem={({ item }) => (
          <MilkCowCard
            row={item}
            disabled={!canLog || isSessionSubmitted}
            tankName={activeTank?.name}
            onChangeYield={updateYield}
            testID={`milk-cow-card-${item.cattleId}`}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: tokens.spacing.sm }} />}
        contentContainerStyle={{
          padding: tokens.spacing.md,
          paddingBottom: 120,
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

      {/* Floating/Docked Summary & Action Footer Bar */}
      <View
        testID="milk-footer-bar"
        style={{
          borderTopWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          paddingHorizontal: tokens.spacing.md,
          paddingVertical: tokens.spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: tokens.spacing.md,
        }}
      >
        {/* Left: Total litres & logged count */}
        <View style={{ gap: 2 }}>
          <Text role="title" color="foreground" style={{ fontWeight: '700' }} testID="milk-total-summary">
            {t('milk.totalLitres', { total: format.numberSafe(liveTotals.totalL, { fractionDigits: 1 }) })}
          </Text>
          <Text role="caption" color="mutedForeground">
            {t('milk.loggedCowsCount', { count: format.numberSafe(liveTotals.loggedCount) })}
          </Text>
        </View>

        {/* Right: Submit session (and Save Draft if drafts exist) */}
        {canLog ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
            {liveTotals.loggedCount > 0 && !isSessionSubmitted ? (
              <Button
                label={t('milk.saveDraft')}
                variant="secondary"
                size="md"
                onPress={() => void saveAllDrafts()}
                testID="milk-save-draft-btn"
              />
            ) : null}
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

      {/* Date Picker Sheet with Missing Status Red Dots & Today Shortcut */}
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

      {/* Search & Filter Bottom Sheet */}
      <MilkFilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        sheds={sheds}
        selectedShedId={selectedShedId}
        statusFilter={statusFilter}
        tanks={tanks}
        selectedTankId={selectedTankId}
        onApply={(f) => {
          setSelectedShedId(f.selectedShedId);
          setStatusFilter(f.statusFilter);
          setSelectedTankId(f.selectedTankId);
        }}
        onReset={() => {
          setSelectedShedId(null);
          setStatusFilter('all');
          setSelectedTankId(null);
        }}
        testID="milk-filter-sheet"
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
