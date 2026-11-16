/**
 * Bottom-sheet Date & Date Range Picker presentation.
 * Features:
 * - Built on SheetModal with backdrop scrim & slide animation
 * - Close button (✕) in header with touch target >= 48dp
 * - Embedded DateRangePicker calendar grid
 * - Localized date range preview
 * - Clear, Cancel and Apply action buttons
 * - ADR-007 compliant: no drop shadows, 1px border and token fills only
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { farmDayKey } from '@rakhal/domain';
import { Button } from '../actions/Button.tsx';
import { IconButton } from '../actions/IconButton.tsx';
import { SheetModal, SheetTitle } from '../internal/SheetModal.tsx';
import { Text } from '../primitives/Text.tsx';
import { useFormat } from '../../i18n/useFormat.ts';
import { useLocale } from '../../providers/LocaleProvider.tsx';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import { DateRangePicker, type DateRange, type PickerDayEntry } from './DateRangePicker.tsx';

export interface DatePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  mode?: 'single' | 'range';
  /** Initial single date value ("YYYY-MM-DD") */
  value?: string | null;
  /** Initial date range */
  range?: DateRange;
  onConfirmSingle?: (date: string | null) => void;
  onConfirmRange?: (range: DateRange) => void;
  minDate?: string;
  maxDate?: string;
  title?: string;
  /** Optional entry status information per calendar day (e.g. missing entry red dots) */
  days?: PickerDayEntry[];
  testID?: string;
}

const DEFAULT_RANGE: DateRange = Object.freeze({ startDate: null, endDate: null });

export function DatePickerSheet({
  visible,
  onClose,
  mode = 'range',
  value: initialValue = null,
  range: initialRange = DEFAULT_RANGE,
  onConfirmSingle,
  onConfirmRange,
  minDate,
  maxDate,
  title,
  days,
  testID,
}: DatePickerSheetProps) {
  const { t } = useLocale();
  const { tokens } = useTheme();
  const format = useFormat();

  const [selectedSingle, setSelectedSingle] = useState<string | null>(initialValue);
  const [selectedRange, setSelectedRange] = useState<DateRange>(initialRange);

  useEffect(() => {
    if (visible) {
      setSelectedSingle(initialValue);
      setSelectedRange(initialRange);
    }
  }, [visible, initialValue, initialRange.startDate, initialRange.endDate]);

  const handleApply = () => {
    if (mode === 'single') {
      onConfirmSingle?.(selectedSingle);
    } else {
      onConfirmRange?.(selectedRange);
    }
    onClose();
  };

  const handleClear = () => {
    if (mode === 'single') {
      setSelectedSingle(null);
    } else {
      setSelectedRange({ startDate: null, endDate: null });
    }
  };

  const handleToday = () => {
    const today = farmDayKey(Date.now());
    if (mode === 'single') {
      setSelectedSingle(today);
    } else {
      setSelectedRange({ startDate: today, endDate: today });
    }
  };

  const sheetTitle = title ?? (mode === 'single' ? t('picker.singleDate') : t('picker.dateRange'));

  // Formatted date preview for selected dates
  const formatDatePreview = (dateKey: string | null) => {
    if (!dateKey) return null;
    const [y, m, d] = dateKey.split('-').map(Number);
    return format.dateSafe(new Date(Date.UTC(y, m - 1, d)));
  };

  const rangePreview =
    mode === 'single'
      ? selectedSingle
        ? formatDatePreview(selectedSingle)
        : null
      : selectedRange.startDate && selectedRange.endDate
        ? `${formatDatePreview(selectedRange.startDate)} – ${formatDatePreview(selectedRange.endDate)}`
        : selectedRange.startDate
          ? `${formatDatePreview(selectedRange.startDate)} – ...`
          : null;

  return (
    <SheetModal visible={visible} onRequestClose={onClose} testID={testID ?? 'date-picker-sheet'}>
      {/* Header with Title & Close (✕) Button */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: tokens.spacing.xs,
        }}
      >
        <SheetTitle>{sheetTitle}</SheetTitle>
        <IconButton
          icon="close"
          accessibilityLabel={t('picker.close')}
          variant="ghost"
          size="md"
          onPress={onClose}
          testID="picker-close"
        />
      </View>

      {/* Selected Date Summary Tag */}
      {rangePreview ? (
        <View
          testID="picker-preview"
          style={{
            alignSelf: 'flex-start',
            paddingVertical: tokens.spacing.xs,
          }}
        >
          <Text role="caption" color="mutedForeground">
            {rangePreview}
          </Text>
        </View>
      ) : null}

      {/* Calendar Grid */}
      <DateRangePicker
        mode={mode}
        value={selectedSingle}
        range={selectedRange}
        onChangeSingle={setSelectedSingle}
        onChangeRange={setSelectedRange}
        minDate={minDate}
        maxDate={maxDate}
        days={days}
        testID="sheet-calendar-grid"
      />

      {/* Action Footer */}
      <View
        style={{
          marginTop: tokens.spacing.md,
          gap: tokens.spacing.sm,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: tokens.spacing.sm,
          }}
        >
          <Button
            label={t('picker.today')}
            variant="secondary"
            size="md"
            onPress={handleToday}
            testID="picker-today"
          />
          <Button
            label={t('picker.clear')}
            variant="ghost"
            size="md"
            onPress={handleClear}
            testID="picker-clear"
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: tokens.spacing.sm,
          }}
        >
          <View style={{ flex: 1 }}>
            <Button
              label={t('picker.cancel')}
              variant="secondary"
              size="md"
              onPress={onClose}
              testID="picker-cancel"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={t('picker.apply')}
              variant="primary"
              size="md"
              onPress={handleApply}
              testID="picker-apply"
            />
          </View>
        </View>
      </View>
    </SheetModal>
  );
}
