/**
 * Accessible Date & Date Range Picker calendar grid component.
 * Supports:
 * - Single date selection
 * - Range selection (start, connected in-between range, and end)
 * - Month & Year selector navigation with < and > arrows
 * - Today's date indicator
 * - Min/max date disabling
 * - Touch targets >= 48dp
 * - English and Bangla localization (numerals & names)
 * - Light and dark theme tokens (teal theme)
 * - ADR-007 compliant (no drop shadows)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { applyDigits, farmDayKey } from '@rakhal/domain';
import { Glyph } from '../internal/Glyph.tsx';
import { PressableSurface } from '../internal/PressableSurface.tsx';
import { Text } from '../primitives/Text.tsx';
import { useLocale } from '../../providers/LocaleProvider.tsx';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import {
  DAY_OF_WEEK_LABELS,
  formatMonthYearHeader,
  getCalendarGrid,
  isBetween,
  isDateAfter,
  isDateBefore,
  isSameDay,
  parseDateKey,
  type CalendarDay,
} from './calendar-utils.ts';

export interface DateRange {
  startDate: string | null;
  endDate: string | null;
}

export type PickerDayStatus = 'complete' | 'missing' | 'none' | string;

export interface PickerDayEntry {
  date: string;
  status: PickerDayStatus;
}

export interface DateRangePickerProps {
  mode?: 'single' | 'range';
  /** Value for single mode ("YYYY-MM-DD") */
  value?: string | null;
  /** Range for range mode */
  range?: DateRange;
  onChangeSingle?: (date: string) => void;
  onChangeRange?: (range: DateRange) => void;
  minDate?: string;
  maxDate?: string;
  initialYear?: number;
  initialMonth?: number; // 1-12
  /** Optional entry status information per calendar day (e.g. missing entry red dots) */
  days?: PickerDayEntry[];
  testID?: string;
}

export function DateRangePicker({
  mode = 'range',
  value = null,
  range = { startDate: null, endDate: null },
  onChangeSingle,
  onChangeRange,
  minDate,
  maxDate,
  initialYear,
  initialMonth,
  days,
  testID,
}: DateRangePickerProps) {
  const { colors, tokens } = useTheme();
  const { locale, digits } = useLocale();

  const todayKey = useMemo(() => farmDayKey(Date.now()), []);
  const todayParts = useMemo(() => parseDateKey(todayKey)!, [todayKey]);

  // Determine starting view month & year
  const startRef = range.startDate ?? value ?? todayKey;
  const parsedStart = parseDateKey(startRef) ?? todayParts;

  const [currentYear, setCurrentYear] = useState(initialYear ?? parsedStart.year);
  const [currentMonth, setCurrentMonth] = useState(initialMonth ?? parsedStart.month);

  // Sync displayed month/year when selection jumps (e.g. via Today shortcut)
  const prevTargetRef = useRef(startRef);
  useEffect(() => {
    const target = mode === 'single' ? value : range.startDate;
    if (target && target !== prevTargetRef.current) {
      prevTargetRef.current = target;
      const parsed = parseDateKey(target);
      if (parsed) {
        setCurrentYear((prevY) => (prevY !== parsed.year ? parsed.year : prevY));
        setCurrentMonth((prevM) => (prevM !== parsed.month ? parsed.month : prevM));
      }
    }
  }, [value, range.startDate, mode]);

  // Map of date string -> status for fast grid lookup
  const statusByDate = useMemo(() => {
    if (!days || days.length === 0) return null;
    const map = new Map<string, PickerDayStatus>();
    for (const d of days) {
      map.set(d.date, d.status);
    }
    return map;
  }, [days]);

  const prevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const cells = useMemo(() => getCalendarGrid(currentYear, currentMonth), [currentYear, currentMonth]);
  const monthTitle = useMemo(
    () => formatMonthYearHeader(currentYear, currentMonth, locale, digits),
    [currentYear, currentMonth, locale, digits],
  );

  const handleDayPress = (day: CalendarDay) => {
    const key = day.dateKey;
    if (mode === 'single') {
      onChangeSingle?.(key);
      return;
    }

    // Range mode logic
    const { startDate, endDate } = range;
    if (!startDate || (startDate && endDate)) {
      // Start a new range
      onChangeRange?.({ startDate: key, endDate: null });
    } else if (startDate && !endDate) {
      if (isDateBefore(key, startDate)) {
        // Reset start if earlier date chosen
        onChangeRange?.({ startDate: key, endDate: null });
      } else {
        onChangeRange?.({ startDate, endDate: key });
      }
    }
  };

  return (
    <View testID={testID ?? 'date-range-picker'} style={{ width: '100%', gap: tokens.spacing.md }}>
      {/* Month & Year Navigation Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: tokens.spacing.xs,
        }}
      >
        <PressableSurface
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          pressedStyle="overlay"
          onPress={prevMonth}
          testID="picker-prev-month"
          style={{
            minWidth: tokens.touchTarget.min,
            minHeight: tokens.touchTarget.min,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: tokens.radius.full,
          }}
        >
          <View style={{ transform: [{ rotate: '180deg' }] }}>
            <Glyph name="chevronRight" size={20} color="foreground" />
          </View>
        </PressableSurface>

        <Text role="h2" testID="picker-month-year">
          {monthTitle}
        </Text>

        <PressableSurface
          accessibilityRole="button"
          accessibilityLabel="Next month"
          pressedStyle="overlay"
          onPress={nextMonth}
          testID="picker-next-month"
          style={{
            minWidth: tokens.touchTarget.min,
            minHeight: tokens.touchTarget.min,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: tokens.radius.full,
          }}
        >
          <Glyph name="chevronRight" size={20} color="foreground" />
        </PressableSurface>
      </View>

      {/* Day of Week Labels Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {DAY_OF_WEEK_LABELS[locale].map((lbl, idx) => (
          <View key={idx} style={{ flex: 1, alignItems: 'center', paddingVertical: tokens.spacing.xs }}>
            <Text role="caption" color="mutedForeground" style={{ fontWeight: '600' }}>
              {lbl}
            </Text>
          </View>
        ))}
      </View>

      {/* Calendar Day Grid (7 columns per row) */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((cell, idx) => {
          if (!cell) {
            return (
              <View
                key={`empty-${idx}`}
                style={{ width: `${100 / 7}%`, height: tokens.touchTarget.min }}
              />
            );
          }

          const { dateKey, day } = cell;
          const isToday = isSameDay(dateKey, todayKey);
          const isDisabled =
            (minDate !== undefined && isDateBefore(dateKey, minDate)) ||
            (maxDate !== undefined && isDateAfter(dateKey, maxDate));

          const isSingleSelected = mode === 'single' && isSameDay(dateKey, value);
          const isStart = mode === 'range' && isSameDay(dateKey, range.startDate);
          const isEnd = mode === 'range' && isSameDay(dateKey, range.endDate);
          const inRange = mode === 'range' && isBetween(dateKey, range.startDate, range.endDate);
          const hasRangeConnected = Boolean(range.startDate && range.endDate && range.startDate !== range.endDate);

          const isSelected = isSingleSelected || isStart || isEnd;
          const dayStatus = statusByDate?.get(dateKey);

          // Range background connector:
          // If start and range connected: right half filled
          // If end and range connected: left half filled
          // If inRange: full cell filled
          const showLeftConnector = (isEnd || inRange) && hasRangeConnected;
          const showRightConnector = (isStart || inRange) && hasRangeConnected;

          // Day number label localized
          const dayLabel = formatMonthYearHeader(cell.year, cell.month, locale, digits);

          return (
            <View
              key={dateKey}
              style={{
                width: `${100 / 7}%`,
                height: tokens.touchTarget.min,
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
              }}
            >
              {/* Connected Range Background Bands */}
              {showLeftConnector ? (
                <View
                  testID={`range-connector-left-${dateKey}`}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: '50%',
                    top: 4,
                    bottom: 4,
                    backgroundColor: colors.accentTealTint,
                  }}
                />
              ) : null}
              {showRightConnector ? (
                <View
                  testID={`range-connector-right-${dateKey}`}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    right: 0,
                    top: 4,
                    bottom: 4,
                    backgroundColor: colors.accentTealTint,
                  }}
                />
              ) : null}

              {/* Day Cell Touch Target & Circle */}
              <PressableSurface
                accessibilityRole="button"
                accessibilityLabel={`${dayLabel} ${day}`}
                accessibilityState={{ selected: isSelected, disabled: isDisabled }}
                disabled={isDisabled}
                pressedStyle="overlay"
                onPress={() => handleDayPress(cell)}
                testID={`day-${dateKey}`}
                style={{
                  width: tokens.touchTarget.min,
                  height: tokens.touchTarget.min,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: tokens.radius.full,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: isSelected ? colors.accentTeal : 'transparent',
                    borderWidth: isToday && !isSelected ? 1.5 : 0,
                    borderColor: isToday && !isSelected ? colors.accentTeal : 'transparent',
                    opacity: isDisabled ? 0.35 : 1,
                  }}
                >
                  <Text
                    role="body"
                    color={isSelected ? 'card' : inRange ? 'foreground' : 'foreground'}
                    style={{
                      fontWeight: isSelected || isToday ? '600' : 'normal',
                      textAlign: 'center',
                    }}
                  >
                    {applyDigits(String(day), digits)}
                  </Text>
                  {dayStatus === 'missing' ? (
                    <View
                      testID={`day-status-dot-${dateKey}`}
                      style={{
                        position: 'absolute',
                        bottom: 2,
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: colors.destructive,
                      }}
                    />
                  ) : null}
                </View>
              </PressableSurface>
            </View>
          );
        })}
      </View>
    </View>
  );
}
