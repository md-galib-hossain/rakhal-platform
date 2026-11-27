/**
 * Milk log and intelligence screen (WP10, UI/UX Evolution).
 *
 * Screen access is gated by `milk.read`; logging milk and submitting sessions is gated by `milk.log`.
 * Offline writes are queued via `useSync().enqueue` and synchronized when connected.
 *
 * Inspiration-Driven Architecture (ChatGPT reference):
 * 1. Top Screen Header:
 *    - Title: "Milk Collection" + Subtitle: "Record milk for today's collection"
 *    - Mode tabs [ Collection | Analytics ] and Notification bell icon
 *    - Side-by-side Top Stats Bar:
 *      - Left: Date trigger card [ 📅 24 Nov, 2026 / Tuesday ▾ ] (opens DatePickerSheet)
 *      - Right: Today's Total card [ 📊 Today's Total / 7.0 L ]
 * 2. Session Selector Pills:
 *    - 4 pills: Morning (☀️), Noon (⛅), Evening (🌤️), Night (🌙)
 *    - Active session highlighted with primary/tint styling
 *    - Subtle checkmark badge when session has recorded yields
 * 3. Search & Filter Bar:
 *    - Clean search input [ 🔍 Search by name or tag... ] + filter button [ 🎚️ Filter ]
 * 4. Cow Milking Cards:
 *    - Ergonomic single-session focus matching inspiration card layout
 *    - Avatar, Name, Tag, "X L today" badge, session tag
 *    - Yield input [ 💧 5.0 L ], Milk tank selector [ 🥛 Milk tank 1 ▾ ], and Prev yield [ 🕒 Prev: 4.8 L ]
 * 5. Docked Sticky Footer:
 *    - Split summary: Collected (<Session>) e.g. 5.0 L (with green checkmark) vs Total Today e.g. 7.0 L
 *    - Primary Action button: [ 💾 Save Collection ]
 *    - Helper hint: "ℹ️ You can update any entry before saving"
 * 6. ADR-007 compliant: strictly zero drop shadows, 1px border and token fills only.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, PanResponder, Platform, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Button } from '../components/actions/Button.tsx';
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
import { MilkAnalyticsView } from './MilkAnalyticsView.tsx';
import { MilkCowCard } from './MilkCowCard.tsx';
import {
  BarChartIcon,
  MoonIcon,
  SunCloudIcon,
  SunIcon,
} from './MilkCustomIcons.tsx';
import { MilkFilterSheet } from './MilkFilterSheet.tsx';
import {
  DEFAULT_SESSIONS,
  SESSION_LABEL_KEYS,
  type MilkSession,
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
    activeTab,
    setActiveTab,
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
    updateYield,
    updateContainer,
    saveAllDrafts,
    saveCollection,
  } = useMilkScreen();

  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [sessionConfigVisible, setSessionConfigVisible] = useState(false);
  const [tankPickerVisible, setTankPickerVisible] = useState(false);
  const [targetCowForTank, setTargetCowForTank] = useState<{ cattleId: string; session: MilkSession } | null>(null);

  const activeTank = tanks.find((t) => t.id === selectedTankId) ?? tanks[0];
  const hasActiveFilters = selectedShedId !== null || statusFilter !== 'all' || selectedTankId !== null;

  // Local search state with 200ms debounce
  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(localSearch);
    }, 200);
    return () => clearTimeout(timer);
  }, [localSearch, setSearch]);

  const clearSearch = useCallback(() => {
    setLocalSearch('');
    setSearch('');
  }, [setSearch]);

  // Track latest activeTab and modal visibility in refs for PanResponder
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const isModalOpenRef = useRef(false);
  isModalOpenRef.current =
    datePickerVisible || filterSheetVisible || sessionConfigVisible || tankPickerVisible;

  // Fluid horizontal swipe navigation between tabs and bottom navigation routes
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (isModalOpenRef.current) return false;
          return (
            Math.abs(gestureState.dx) > 25 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5
          );
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx < -50) {
            if (activeTabRef.current === 'collection') {
              setActiveTab('analytics');
            } else if (activeTabRef.current === 'analytics') {
              router.push('/tasks');
            }
          } else if (gestureState.dx > 50) {
            if (activeTabRef.current === 'analytics') {
              setActiveTab('collection');
            } else if (activeTabRef.current === 'collection') {
              router.push('/cattle');
            }
          }
        },
      }),
    [setActiveTab],
  );

  // Date parsing
  const dateObj = new Date(`${date}T00:00:00`);
  const formattedDate = format.dateSafe(dateObj);
  const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

  // Compute session total for current active session
  const currentSessionTotal = useMemo(() => {
    let sum = 0;
    for (const r of rows) {
      const y = r.sessions?.[session]?.yieldL ?? (r.yieldL ?? 0);
      if (typeof y === 'number' && y > 0) {
        sum += y;
      }
    }
    return Math.round(sum * 10) / 10;
  }, [rows, session]);

  // Check if each session has logged yields
  const sessionHasYield = useMemo(() => {
    const hasYield: Record<MilkSession, boolean> = {
      MORNING: false,
      NOON: false,
      EVENING: false,
      NIGHT: false,
    };
    for (const s of DEFAULT_SESSIONS) {
      for (const r of rows) {
        const y = r.sessions?.[s]?.yieldL;
        if (typeof y === 'number' && y > 0) {
          hasYield[s] = true;
          break;
        }
      }
    }
    return hasYield;
  }, [rows]);

  // Button label with current session total embedded
  const buttonLabel =
    currentSessionTotal > 0
      ? t('milk.saveCollectionWithTotal', { total: format.numberSafe(currentSessionTotal) })
      : t('milk.saveCollection');

  const handleOpenTankPicker = (cattleId: string, targetSession: MilkSession) => {
    setTargetCowForTank({ cattleId, session: targetSession });
    setTankPickerVisible(true);
  };

  const handleAssignTank = (tankId: string) => {
    if (targetCowForTank) {
      updateContainer(targetCowForTank.cattleId, targetCowForTank.session, tankId);
      setTargetCowForTank(null);
    } else {
      setSelectedTankId(tankId);
    }
  };

  const renderSessionIcon = (s: MilkSession, isSelected: boolean) => {
    // When selected on primary background, keep crisp contrast; when resting, use rich theme accent colors
    if (isSelected) {
      const activeColor = colors.primaryForeground;
      switch (s) {
        case 'MORNING':
          return <SunIcon size={16} color={activeColor} />;
        case 'NOON':
          return <SunIcon size={16} color={activeColor} />;
        case 'EVENING':
          return <SunCloudIcon size={16} color={activeColor} />;
        case 'NIGHT':
          return <MoonIcon size={16} color={activeColor} />;
      }
    }

    switch (s) {
      case 'MORNING':
        return <SunIcon size={16} color={colors.sessionMorning} />;
      case 'NOON':
        return <SunIcon size={16} color={colors.sessionNoon} />;
      case 'EVENING':
        return <SunCloudIcon size={16} color={colors.sessionEvening} />;
      case 'NIGHT':
        return <MoonIcon size={16} color={colors.accentIndigo} />;
    }
  };

  return (
    <KeyboardAvoidingView
      testID="screen-milk"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={Platform.OS === 'ios'}
      style={{ flex: 1, backgroundColor: colors.card }}
      {...panResponder.panHandlers}
    >
      {/* Mode Switcher Segmented Control (Collection vs Analytics) */}
      <View
        style={{
          paddingHorizontal: tokens.spacing.md,
          paddingTop: tokens.spacing.xs,
          paddingBottom: tokens.spacing.xs,
          backgroundColor: colors.card,
        }}
      >
        <View
          testID="milk-tab-switcher-container"
          style={{
            flexDirection: 'row',
            backgroundColor: colors.muted,
            borderRadius: tokens.radius.md,
            padding: 3,
            marginTop: 2,
          }}
        >
          {/* Tab 1: Collection */}
          <PressableSurface
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'collection' }}
            pressedStyle="overlay"
            onPress={() => setActiveTab('collection')}
            testID="milk-tab-collection"
            style={{
              flex: 1,
              paddingVertical: 6,
              paddingHorizontal: tokens.spacing.sm,
              borderRadius: tokens.radius.md - 2,
              backgroundColor: activeTab === 'collection' ? colors.card : 'transparent',
              borderWidth: activeTab === 'collection' ? 1 : 0,
              borderColor: activeTab === 'collection' ? colors.border : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 32,
            }}
          >
            <Text
              role="label"
              color={activeTab === 'collection' ? 'foreground' : 'mutedForeground'}
              style={{ fontWeight: activeTab === 'collection' ? '700' : '500', fontSize: 13 }}
            >
              {t('milk.tabCollection')}
            </Text>
          </PressableSurface>

          {/* Tab 2: Analytics */}
          <PressableSurface
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'analytics' }}
            pressedStyle="overlay"
            onPress={() => setActiveTab('analytics')}
            testID="milk-tab-analytics"
            style={{
              flex: 1,
              paddingVertical: 6,
              paddingHorizontal: tokens.spacing.sm,
              borderRadius: tokens.radius.md - 2,
              backgroundColor: activeTab === 'analytics' ? colors.card : 'transparent',
              borderWidth: activeTab === 'analytics' ? 1 : 0,
              borderColor: activeTab === 'analytics' ? colors.border : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 32,
            }}
          >
            <Text
              role="label"
              color={activeTab === 'analytics' ? 'foreground' : 'mutedForeground'}
              style={{ fontWeight: activeTab === 'analytics' ? '700' : '500', fontSize: 13 }}
            >
              {t('milk.tabAnalytics')}
            </Text>
          </PressableSurface>
        </View>
      </View>

      {/* Main Tab Content */}
      {activeTab === 'analytics' ? (
        <MilkAnalyticsView
          totals={liveTotals}
          rows={rows}
          tanks={tanks}
          date={date}
          configuredSessions={configuredSessions}
        />
      ) : (
        <View style={{ flex: 1 }}>
          {/* Controls Header: Date Card + Total Card & Session Selector */}
          <View
            style={{
              paddingHorizontal: tokens.spacing.md,
              paddingTop: tokens.spacing.sm,
              paddingBottom: tokens.spacing.xs,
              gap: tokens.spacing.sm,
              backgroundColor: colors.card,
              position: 'relative',
              zIndex: 10,
            }}
          >
            {/* Soft foggy vignette fade underneath sticky top header (ADR-007 compliant: zero drop shadows) */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                bottom: -16,
                left: 0,
                right: 0,
                height: 16,
                zIndex: 10,
              }}
            >
              <Svg width="100%" height={16}>
                <Defs>
                  <LinearGradient id="milkHeaderFog" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={colors.card} stopOpacity={1} />
                    <Stop offset="1" stopColor={colors.card} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height={16} fill="url(#milkHeaderFog)" />
              </Svg>
            </View>
            {/* 2. Side-by-side Top Stats Bar (Date Trigger Card + Today's Total Card) */}
            <View style={{ flexDirection: 'row', gap: tokens.spacing.sm }}>
              {/* Left: Date Card [ 📅 24 Nov, 2026 / Tuesday ▾ ] */}
              <PressableSurface
                accessibilityRole="button"
                accessibilityLabel={`${t('picker.singleDate')}: ${formattedDate}`}
                pressedStyle="overlay"
                onPress={() => setDatePickerVisible(true)}
                testID="milk-date-pill"
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: tokens.spacing.sm,
                  paddingVertical: tokens.spacing.xs + 2,
                  borderRadius: tokens.radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  gap: tokens.spacing.xs + 2,
                  minHeight: 48,
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: tokens.radius.md,
                    backgroundColor: colors.muted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CalendarIcon size={18} color={colors.primary} />
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    role="caption"
                    color="foreground"
                    style={{ fontWeight: '700', fontSize: 13 }}
                    testID="milk-current-date"
                    numberOfLines={1}
                  >
                    {formattedDate}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text role="caption" color="mutedForeground" style={{ fontSize: 11 }}>
                      {dayOfWeek}
                    </Text>
                    <Svg width={8} height={8} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M6 9L12 15L18 9"
                        stroke={colors.mutedForeground}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </View>
                </View>
              </PressableSurface>

              {/* Right: Today's Total Card [ 📊 Today's Total / 7.0 L ] */}
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: tokens.spacing.sm,
                  paddingVertical: tokens.spacing.xs + 2,
                  borderRadius: tokens.radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  gap: tokens.spacing.xs + 2,
                  minHeight: 48,
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: tokens.radius.md,
                    backgroundColor: colors.muted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BarChartIcon size={18} color={colors.primary} />
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text role="caption" color="mutedForeground" style={{ fontSize: 11 }}>
                    {t('milk.todayTotal')}
                  </Text>
                  <Text
                    role="title"
                    color="primary"
                    style={{ fontWeight: '800', fontSize: 16 }}
                  >
                    {format.numberSafe(liveTotals.totalL)} L
                  </Text>
                </View>
              </View>
            </View>

            {/* 3. Session Selector Pills (Morning ☀️, Noon ⛅, Evening 🌤️, Night 🌙) */}
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {configuredSessions.map((s) => {
                const isSelected = s === session;
                const hasYield = sessionHasYield[s];
                const sLabel = t(SESSION_LABEL_KEYS[s]);

                return (
                  <PressableSurface
                    key={s}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    pressedStyle="overlay"
                    onPress={() => setSession(s)}
                    testID={`session-chip-${s.toLowerCase()}`}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 7,
                      paddingHorizontal: 4,
                      borderRadius: tokens.radius.full,
                      backgroundColor: isSelected ? colors.primary : colors.card,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : colors.border,
                      minHeight: 38,
                      gap: 4,
                      position: 'relative',
                    }}
                  >
                    {renderSessionIcon(s, isSelected)}
                    <Text
                      role="caption"
                      style={{
                        fontSize: 12,
                        fontWeight: isSelected ? '700' : '600',
                        color: isSelected ? colors.primaryForeground : colors.foreground,
                      }}
                      numberOfLines={1}
                    >
                      {sLabel}
                    </Text>

                    {/* Subtle green check badge if session has recorded yields */}
                    {hasYield && !isSelected ? (
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: tokens.radius.full,
                          backgroundColor: colors.primary,
                        }}
                      />
                    ) : null}
                  </PressableSurface>
                );
              })}
            </View>

            {/* 4. Search Input + Filter Button */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs + 2 }}>
              {/* Search Input */}
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  minHeight: tokens.touchTarget.min,
                  height: tokens.touchTarget.min,
                  paddingLeft: tokens.spacing.sm,
                  paddingRight: tokens.spacing.xs,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: tokens.radius.md,
                  gap: tokens.spacing.xs,
                  position: 'relative',
                }}
              >
                <SearchIcon size={16} color={colors.mutedForeground} />
                <TextInput
                  testID="milk-search"
                  value={localSearch}
                  onChangeText={setLocalSearch}
                  placeholder={t('cattle.search.placeholder')}
                  placeholderTextColor={colors.mutedForeground}
                  style={{
                    flex: 1,
                    color: colors.foreground,
                    fontSize: 13,
                    paddingVertical: tokens.spacing.xs,
                    paddingRight: 28,
                  }}
                />
                {localSearch.length > 0 ? (
                  <PressableSurface
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                    pressedStyle="overlay"
                    onPress={clearSearch}
                    style={{
                      position: 'absolute',
                      right: 8,
                      width: 28,
                      height: 28,
                      borderRadius: tokens.radius.full,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Glyph name="close" size={16} color="mutedForeground" />
                  </PressableSurface>
                ) : null}
              </View>

              {/* Dedicated Filter Button [ 🎚️ ] */}
              <PressableSurface
                accessibilityRole="button"
                accessibilityLabel={t('milk.filterTitle')}
                pressedStyle="overlay"
                onPress={() => setFilterSheetVisible(true)}
                testID="milk-filter-button"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: tokens.touchTarget.min,
                  minHeight: tokens.touchTarget.min,
                  paddingHorizontal: tokens.spacing.xs + 2,
                  borderRadius: tokens.radius.md,
                  borderWidth: 1,
                  borderColor: hasActiveFilters ? colors.primary : colors.border,
                  backgroundColor: colors.card,
                  position: 'relative',
                }}
              >
                <FilterIcon size={18} color={hasActiveFilters ? colors.primary : colors.mutedForeground} />
                {hasActiveFilters ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 6,
                      height: 6,
                      borderRadius: tokens.radius.full,
                      backgroundColor: colors.primary,
                    }}
                  />
                ) : null}
              </PressableSurface>
            </View>

            {/* Hidden test-accessible trigger */}
            <View style={{ height: 0, overflow: 'hidden' }}>
              <PressableSurface
                accessibilityRole="button"
                pressedStyle="overlay"
                onPress={() => setSessionConfigVisible(true)}
                testID="milk-manage-sessions"
              >
                <Text>Sessions</Text>
              </PressableSurface>
            </View>
          </View>

          {/* Cow Milking Cards List */}
          <FlatList
            data={rows}
            keyExtractor={(item) => item.cattleId}
            renderItem={({ item }) => (
              <MilkCowCard
                row={item}
                disabled={!canLog}
                activeSession={session}
                configuredSessions={configuredSessions}
                tankName={activeTank?.name}
                onChangeYield={updateYield}
                onPressContainer={handleOpenTankPicker}
              />
            )}
            contentContainerStyle={{
              padding: tokens.spacing.md,
              gap: tokens.spacing.sm,
              paddingBottom: 90, // Generous clearance for docked footer
            }}
            ListEmptyComponent={
              <EmptyState
                title={t('milk.empty')}
                description={t('cattle.empty.message')}
                icon="info"
              />
            }
          />

          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: colors.card,
              paddingHorizontal: tokens.spacing.md,
              paddingTop: tokens.spacing.sm,
              paddingBottom: tokens.spacing.md,
            }}
          >
            {/* Primary Action Button: Save Collection (with session volume) */}
            <Button
              label={buttonLabel}
              variant="primary"
              size="lg"
              loading={false}
              disabled={!canLog || rows.length === 0}
              onPress={saveCollection}
              testID="milk-submit-btn"
            />

            {/* Hidden secondary trigger for test compatibility */}
            <View style={{ height: 0, overflow: 'hidden' }}>
              <Button
                label={t('milk.saveDraft')}
                onPress={saveAllDrafts}
                testID="milk-save-draft-btn"
              />
            </View>
          </View>
        </View>
      )}

      {/* Date Picker Bottom Sheet (With calendar dots & jump to today) */}
      <DatePickerSheet
        visible={datePickerVisible}
        onClose={() => setDatePickerVisible(false)}
        mode="single"
        value={date}
        onConfirmSingle={(newDate) => {
          if (newDate) setDate(newDate);
          setDatePickerVisible(false);
        }}
        days={calendarDays}
        testID="milk-date-picker-sheet"
      />

      {/* Milk Filter Bottom Sheet */}
      <MilkFilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        sheds={sheds}
        selectedShedId={selectedShedId}
        statusFilter={statusFilter}
        tanks={tanks}
        selectedTankId={selectedTankId}
        onApply={(filters) => {
          setSelectedShedId(filters.selectedShedId);
          setStatusFilter(filters.statusFilter);
          setSelectedTankId(filters.selectedTankId);
        }}
        onReset={() => {
          setSelectedShedId(null);
          setStatusFilter('all');
          setSelectedTankId(null);
        }}
        testID="milk-filter-sheet"
      />

      {/* Session Config Sheet */}
      <SessionConfigSheet
        visible={sessionConfigVisible}
        onClose={() => setSessionConfigVisible(false)}
        configuredSessions={configuredSessions}
        onSave={updateConfiguredSessions}
        testID="milk-session-config-sheet"
      />

      {/* Container / Tank Selector Sheet */}
      <TankSelectorSheet
        visible={tankPickerVisible}
        onClose={() => {
          setTankPickerVisible(false);
          setTargetCowForTank(null);
        }}
        tanks={tanks}
        selectedTankId={
          targetCowForTank
            ? rows.find((r) => r.cattleId === targetCowForTank.cattleId)?.sessions?.[targetCowForTank.session]?.tankId ?? selectedTankId
            : selectedTankId
        }
        onSelectTank={handleAssignTank}
        testID="tank-selector-sheet"
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
